import { pool } from '../db.mjs';

export const registerMediaRoutes = async (app) => {
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

      const r = await pool.query('select image_mime, image_bytes, image_url, image_variants from photos where id=$1', [id]);
      if (r.rowCount === 0) return reply.code(404).send();
      
      const photo = r.rows[0];
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

      if (!targetUrl) return reply.code(404).send();

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
      const r = await pool.query('select avatar_mime, avatar_bytes, avatar_url from users where id=$1', [id]);
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
      
      return reply.code(404).send();
    },
  });
};

