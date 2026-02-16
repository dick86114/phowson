import { pool } from '../db.mjs';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client, isObjectStorageEnabled } from '../lib/object_storage.mjs';

export const registerMediaRoutes = async (app) => {
  app.get('/media/s3/*', {
    handler: async (req, reply) => {
      if (!isObjectStorageEnabled()) return reply.code(404).send();
      
      const s3 = getS3Client();
      if (!s3) return reply.code(404).send();

      // Extract key from URL
      // req.params['*'] is available if using wildcards properly, but let's parse req.url to be safe
      // Fastify wildcard route matching puts the wildcard part in params['*']
      const key = req.params['*'];
      if (!key) return reply.code(400).send();

      try {
        const Bucket = String(process.env.S3_BUCKET);
        const command = new GetObjectCommand({
          Bucket,
          Key: key,
        });
        const response = await s3.send(command);

        if (response.ContentType) {
          reply.type(response.ContentType);
        }
        
        // AWS SDK v3 Body is a stream
            return reply.send(response.Body);
          } catch (err) {
            req.log.error({ err, key, bucket: process.env.S3_BUCKET }, 'S3 proxy error');
            if (err.name === 'NoSuchKey') {
                return reply.code(404).send({ error: 'NoSuchKey', key });
            }
            return reply.code(502).send({ error: err.message });
          }
        }
      });

  app.get('/media/photos/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
      querystring: {
        type: 'object',
        properties: {
          variant: { type: 'string', enum: ['thumb', 'medium', 'original'] }
        }
      }
    },
    handler: async (req, reply) => {
      const id = String(req.params.id);
      const variant = req.query.variant || 'original';

      const user = req.authUser;
      const r = await pool.query('select owner_user_id, is_public, image_mime, image_bytes, image_url, image_variants from photos where id=$1', [id]);
      if (r.rowCount === 0) return reply.code(404).send();
      
      const photo = r.rows[0];
      if (!photo.is_public) {
        if (!user) return reply.code(404).send();
        if (user.role !== 'admin' && String(photo.owner_user_id || '') !== String(user.id || '')) {
          return reply.code(404).send();
        }
      }
      const variants = photo.image_variants || {};

      // If we have bytes (local storage), serve them if original is requested or it's the only option
      if (photo.image_bytes && variant === 'original') {
        const mime = photo.image_mime || 'application/octet-stream';
        return reply.type(mime).send(photo.image_bytes);
      }

      // Determine target URL based on variant
      let targetUrl = photo.image_url;
      if (variant === 'medium' && variants.medium) targetUrl = variants.medium;
      if (variant === 'thumb' && variants.thumb) targetUrl = variants.thumb;

      // Fallback: if specific variant requested but missing, try to use original if available
      if ((variant === 'thumb' || variant === 'medium') && !targetUrl) {
         targetUrl = photo.image_url;
      }

      // Special case: if we have local bytes and no targetUrl (or we want to serve local bytes for original),
      // we can serve bytes. But here we handle the case where we might need to proxy.
      
      // If we have no targetUrl, but we have bytes, we should serve bytes regardless of variant request
      // (effectively falling back to original bytes)
      if (!targetUrl && photo.image_bytes) {
         const mime = photo.image_mime || 'application/octet-stream';
         return reply.type(mime).send(photo.image_bytes);
      }

      if (!targetUrl) return reply.code(404).send();

      // Handle relative URLs (local files) by redirecting
      if (!targetUrl.startsWith('http')) {
        return reply.redirect(targetUrl);
      }

      // Proxy the external URL to ensure CORS headers are handled by our server
      try {
        const response = await fetch(targetUrl);
        if (!response.ok) {
           return reply.code(response.status).send();
        }
        
        const contentType = response.headers.get('content-type');
        if (contentType) reply.type(contentType);
        
        return reply.send(response.body);
      } catch (err) {
        req.log.error(err);
        return reply.code(502).send();
      }
    },
  });

  app.get('/media/avatars/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
    },
    handler: async (req, reply) => {
      const id = String(req.params.id);
      const r = await pool.query('select name, avatar_mime, avatar_bytes, avatar_url from users where id=$1', [id]);
      if (r.rowCount === 0) return reply.code(404).send();
      
      const user = r.rows[0];
      
      if (user.avatar_bytes) {
        const mime = user.avatar_mime || 'application/octet-stream';
        return reply.type(mime).send(user.avatar_bytes);
      }
      
      if (user.avatar_url) {
         try {
            const response = await fetch(user.avatar_url);
            if (!response.ok) return reply.code(response.status).send();
            
            const contentType = response.headers.get('content-type');
            if (contentType) reply.type(contentType);
            
            return reply.send(response.body);
         } catch (err) {
            req.log.error(err);
            return reply.code(502).send();
         }
      }
      
      const name = user.name || 'User';
      return reply.redirect(`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`);
    },
  });

  app.get('/media/files/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
    },
    handler: async (req, reply) => {
      const id = String(req.params.id);
      const r = await pool.query('select mime, data from files where id=$1', [id]);
      if (r.rowCount === 0) return reply.code(404).send();

      const file = r.rows[0];
      const mime = file.mime || 'application/octet-stream';
      return reply.type(mime).send(file.data);
    },
  });
};
