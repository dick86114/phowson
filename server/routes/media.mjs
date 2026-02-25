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

      // 修正 MinIO 403 问题：
      // 如果目标 URL 是私有 S3 URL (presigned)，直接 fetch 可能因为 Host 头问题失败（尤其是 minio）。
      // 更好的方式是：如果 URL 本身可访问，直接 redirect 给前端让浏览器去下；
      // 但这里为了解决 CORS/鉴权统一，我们继续尝试 proxy。
      
      // 注意：如果 targetUrl 是 S3 预签名 URL，通常不需要额外的 headers。
      // 但如果 targetUrl 是 MinIO 的永久链接且 Bucket 是 Private，直接 fetch 会 403。
      // 在我们的架构中，S3 上传后生成的是 "http://minio:9000/bucket/key" 这种内网 URL (S3_PUBLIC_BASE_URL)
      // 如果配置的是内网地址，必须由后端 proxy。
      
      try {
        const response = await fetch(targetUrl);
        if (!response.ok) {
           // 如果是 403，可能是 MinIO 拒绝了。
           // 尝试使用 AWS SDK 获取流（如果配置了 S3）
           if (response.status === 403 && isObjectStorageEnabled()) {
              const s3 = getS3Client();
              if (s3) {
                 // 尝试解析 key。假设 targetUrl 是 .../bucket/key 或 .../key
                 // 这里比较 trick，因为 targetUrl 可能是任意格式。
                 // 但我们可以尝试从 URL path 中提取 key。
                 
                 let key = null;
                 let publicBase = process.env.S3_PUBLIC_BASE_URL;

                 // 如果未配置 S3_PUBLIC_BASE_URL，尝试根据 S3_ENDPOINT 和 S3_BUCKET 推断 (针对 MinIO Path Style)
                 if (!publicBase && process.env.S3_ENDPOINT && process.env.S3_BUCKET) {
                    publicBase = String(process.env.S3_ENDPOINT).replace(/\/+$/, '') + '/' + String(process.env.S3_BUCKET);
                 }

                 if (publicBase && targetUrl.startsWith(publicBase)) {
                    key = targetUrl.slice(publicBase.length);
                    if (key.startsWith('/')) key = key.slice(1);
                 }
                 
                 if (key) {
                    try {
                      const Bucket = String(process.env.S3_BUCKET);
                      const command = new GetObjectCommand({ Bucket, Key: key });
                      const s3Res = await s3.send(command);
                      if (s3Res.ContentType) reply.type(s3Res.ContentType);
                      return reply.send(s3Res.Body);
                    } catch (ignore) {
                       // 忽略 S3 错误，继续返回原始 403
                    }
                 }
              }
           }
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
