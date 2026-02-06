import { pool } from '../db.mjs';
import { upsertUser } from '../db/users.mjs';
import { photoSelectSql } from '../db/photos_sql.mjs';
import { normalizeExif } from '../lib/exif.mjs';
import { parseTags, safeJsonParse } from '../lib/parsers.mjs';
import { HttpError, badRequest, notFound } from '../lib/http_errors.mjs';
import { requireAdmin, requireMember } from '../plugins/rbac.mjs';
import { createPhotoObjectKey, createVariantObjectKey, deleteObjectByUrl, isObjectStorageEnabled, putPhotoObject } from '../lib/object_storage.mjs';
import crypto from 'node:crypto';
import { generatePhotoVariants } from '../lib/image_variants.mjs';
import { getPhotoImage } from '../lib/photo_image.mjs';
import { critiqueFromImage, fillFromImage } from '../lib/ai_provider.mjs';
import sharp from 'sharp';
import { bumpUploadActivity } from '../db/activity_logs.mjs';
import { generateEmbedding, buildSemanticText } from '../lib/embedding.mjs';
import { verifyCaptcha } from '../lib/captcha.mjs';

const localDayIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const ensureMultipart = (req) => {
  if (!req.isMultipart()) throw badRequest('INVALID_CONTENT_TYPE', '需要 multipart/form-data');
};

export const registerPhotoRoutes = async (app) => {
  app.get('/photos', async (req) => {
    const user = req.authUser;
    let sql = photoSelectSql(false);
    const params = [];

    // 不再过滤 status，显示所有照片
    sql += " order by p.created_at desc";
    const r = await pool.query(sql, params);
    return r.rows;
  });

  app.get('/photos/page', async (req) => {
    const q = req.query || {};
    const limitRaw = q.limit ?? q.pageSize ?? 12;
    const offsetRaw = q.offset ?? 0;
    const limit = Math.max(1, Math.min(50, Number.parseInt(String(limitRaw), 10) || 12));
    const offset = Math.max(0, Number.parseInt(String(offsetRaw), 10) || 0);

    const itemsSql = `${photoSelectSql(false)} order by p.created_at desc limit $1 offset $2`;
    const itemsRes = await pool.query(itemsSql, [limit, offset]);
    const totalRes = await pool.query('select count(1)::int as total from photos');
    const total = Number(totalRes.rows?.[0]?.total || 0);
    const items = itemsRes.rows || [];
    const nextOffset = offset + items.length;

    return {
      items,
      limit,
      offset,
      total,
      hasMore: nextOffset < total,
      nextOffset,
    };
  });

  // 语义搜索接口
  app.get('/photos/semantic-search', async (req, reply) => {
    const { query, limit = 20 } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw badRequest('INVALID_QUERY', '搜索关键词不能为空');
    }

    try {
      // 1. 生成查询文本的 embedding
      const queryEmbedding = await generateEmbedding(query.trim());

      // 2. 使用余弦相似度搜索
      const sql = `
        SELECT 
          p.id, p.title, p.description, p.url, p.thumb_url, p.medium_url,
          p.tags, p.category, p.exif, p.created_at,
          (p.embedding <=> $1::vector) as distance,
          (1 - (p.embedding <=> $1::vector)) as similarity
        FROM photos p
        WHERE p.embedding IS NOT NULL
          AND p.status = 'approved'
        ORDER BY p.embedding <=> $1::vector
        LIMIT $2
      `;

      const result = await pool.query(sql, [
        JSON.stringify(queryEmbedding),
        parseInt(limit, 10)
      ]);

      return {
        query,
        results: result.rows,
        count: result.rowCount
      };
    } catch (error) {
      console.error('[语义搜索] 失败:', error);
      throw new Error(`语义搜索失败: ${error.message}`);
    }
  });

  app.get('/photos/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
    },
    handler: async (req) => {
      const id = String(req.params.id);
      const sql = `${photoSelectSql(true)} where p.id = $1`;
      const r = await pool.query(sql, [id]);
      if (r.rowCount === 0) throw notFound('PHOTO_NOT_FOUND', '照片不存在');
      return r.rows[0];
    },
  });

  app.post('/photos', { preHandler: requireMember() }, async (req, reply) => {
    ensureMultipart(req);

    const user = req.authUser;
    await upsertUser(user);

    const maxBytesEnv = Number(process.env.UPLOAD_MAX_BYTES);
    const maxBytes = Number.isFinite(maxBytesEnv) && maxBytesEnv > 0 ? maxBytesEnv : 60 * 1024 * 1024;

    const fields = {};
    let file = null;
    let partCount = 0;

    try {
      for await (const part of req.parts()) {
        partCount++;
        if (part.type === 'file') {
          if (part.fieldname === 'photo') {
            const buffer = await part.toBuffer();
            file = {
              buffer,
              mimetype: part.mimetype,
              filename: part.filename,
            };
          } else {
            await part.toBuffer();
          }
        } else {
          fields[part.fieldname] = part.value;
        }
      }
    } catch (err) {
      req.log.error({ err }, 'Failed to parse multipart');
      const code = String(err?.code || '');
      if (code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new HttpError(413, 'PHOTO_TOO_LARGE', `照片过大，最大支持 ${Math.floor(maxBytes / 1024 / 1024)}MB`);
      }
      throw badRequest('MULTIPARSE_FAILED', '文件解析失败: ' + err.message);
    }

    req.log.info({ partCount, fields: Object.keys(fields), hasFile: !!file }, 'Multipart parsed');

    if (!file) throw badRequest('PHOTO_REQUIRED', '缺少照片文件');

    const title = String(fields.title ?? '未命名').trim() || '未命名';
    const description = String(fields.description ?? '');
    const category = String(fields.category ?? 'uncategorized').trim() || 'uncategorized';
    const tags = parseTags(fields.tags);
    const exif = normalizeExif(safeJsonParse(fields.exif, {}));

    const imageBuffer = file.buffer;
    const imageMime = file.mimetype || null;

    if (imageBuffer.length > maxBytes) throw new HttpError(413, 'PHOTO_TOO_LARGE', `照片过大，最大支持 ${Math.floor(maxBytes / 1024 / 1024)}MB`);
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
    if (imageMime && !allowed.has(String(imageMime).toLowerCase())) throw badRequest('PHOTO_MIME_NOT_ALLOWED', '仅支持 jpg/png/webp/avif');

    const imageSizeBytes = imageBuffer.length;
    let imageWidth = null;
    let imageHeight = null;
    try {
      const meta = await sharp(imageBuffer).metadata();
      if (Number.isFinite(meta?.width) && meta.width > 0) imageWidth = meta.width;
      if (Number.isFinite(meta?.height) && meta.height > 0) imageHeight = meta.height;
    } catch {
      imageWidth = null;
      imageHeight = null;
    }

    const id = crypto.randomUUID();

    let imageUrl = null;
    let imageBytes = imageBuffer;
    let imageVariants = {};

    req.log.info({ imageMime, imageSize: imageBuffer.length }, 'Starting S3 upload');

    if (isObjectStorageEnabled()) {
      try {
        const key = createPhotoObjectKey({ photoId: id, mime: imageMime });
        req.log.info({ key }, 'Uploading original image');
        const uploaded = await putPhotoObject({ key, buffer: imageBuffer, mime: imageMime });
        req.log.info({ uploaded: !!uploaded, url: uploaded?.url }, 'Original upload result');

        if (uploaded?.url) {
          imageUrl = uploaded.url;
          imageBytes = null;
        }

        try {
          req.log.info('Generating variants');
          const variants = await generatePhotoVariants(imageBuffer);
          const thumbKey = createVariantObjectKey({ photoId: id, variant: 'thumb', ext: variants.thumb.ext });
          const mediumKey = createVariantObjectKey({ photoId: id, variant: 'medium', ext: variants.medium.ext });

          req.log.info({ thumbKey, mediumKey }, 'Uploading variants');
          const [thumbUploaded, mediumUploaded] = await Promise.all([
            putPhotoObject({ key: thumbKey, buffer: variants.thumb.buffer, mime: variants.thumb.mime }),
            putPhotoObject({ key: mediumKey, buffer: variants.medium.buffer, mime: variants.medium.mime }),
          ]);

          req.log.info({ thumbUploaded: !!thumbUploaded, mediumUploaded: !!mediumUploaded }, 'Variants upload result');

          imageVariants = {
            thumb: thumbUploaded?.url || null,
            medium: mediumUploaded?.url || null,
          };
        } catch (err) {
          req.log.error({ err }, 'Failed to generate/upload variants');
          imageVariants = {};
        }
      } catch (err) {
        req.log.error({ err }, 'Failed to upload to S3');
        throw badRequest('S3_UPLOAD_FAILED', 'S3 上传失败: ' + err.message);
      }
    }

    req.log.info({ userId: user.id, title, category }, 'Inserting photo into database');

    const r = await pool.query(
      `
        insert into photos(id, owner_user_id, title, description, category, tags, exif, image_mime, image_bytes, image_url, image_variants, lat, lng, image_width, image_height, image_size_bytes)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        returning id
      `,
      [id, user.id, title, description, category, tags, exif, imageMime, imageBytes, imageUrl, imageVariants, exif.lat ?? null, exif.lng ?? null, imageWidth, imageHeight, imageSizeBytes],
    );

    const createdId = r.rows[0].id;
    req.log.info({ createdId }, 'Photo inserted successfully');

    try {
      await bumpUploadActivity({ userId: user.id, day: localDayIso() });
      req.log.info('Activity log updated');
    } catch (err) {
      req.log.error({ err }, 'Failed to update activity log');
    }

    const detail = await pool.query(`${photoSelectSql(true)} where p.id = $1`, [createdId]);
    req.log.info('Photo detail fetched, sending response');

    // 异步生成 embedding（不阻塞响应）
    (async () => {
      try {
        const photo = detail.rows[0];
        const semanticText = buildSemanticText(photo);
        
        if (semanticText && semanticText.trim().length > 0) {
          const embedding = await generateEmbedding(semanticText);
          await pool.query(
            'UPDATE photos SET embedding = $1 WHERE id = $2',
            [JSON.stringify(embedding), createdId]
          );
          req.log.info({ photoId: createdId }, 'Embedding generated successfully');
        }
      } catch (err) {
        req.log.error({ err, photoId: createdId }, 'Failed to generate embedding');
      }
    })();

    return reply.code(201).send(detail.rows[0]);
  });

  app.patch('/photos/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
    },
    preHandler: requireAdmin(),
    handler: async (req, reply) => {
      ensureMultipart(req);

      const id = String(req.params.id);
      const user = req.authUser;
      await upsertUser(user);

      const existing = await pool.query('select id from photos where id=$1', [id]);
      if (existing.rowCount === 0) throw notFound('PHOTO_NOT_FOUND', '照片不存在');

      const fields = {};
      let file = null;

      for await (const part of req.parts()) {
        if (part.type === 'file') {
          if (part.fieldname === 'photo') {
            const buffer = await part.toBuffer();
            file = {
              buffer,
              mimetype: part.mimetype,
              filename: part.filename,
            };
          } else {
            await part.toBuffer();
          }
        } else {
          fields[part.fieldname] = part.value;
        }
      }

      const title = fields.title != null ? String(fields.title).trim() : null;
      const description = fields.description != null ? String(fields.description) : null;
      const category = fields.category != null ? String(fields.category).trim() : null;
      const tags = fields.tags != null ? parseTags(fields.tags) : null;
      const exif = fields.exif != null ? normalizeExif(safeJsonParse(fields.exif, {})) : null;

      const imageBuffer = file ? file.buffer : null;
      const imageMime = file?.mimetype || null;

      let imageUrl = null;
      let imageBytes = imageBuffer;
      let imageVariants = null;
      let imageWidth = null;
      let imageHeight = null;
      let imageSizeBytes = null;
      if (imageBuffer) {
        const maxBytes = Number(process.env.UPLOAD_MAX_BYTES || 25 * 1024 * 1024);
        if (imageBuffer.length > maxBytes) throw badRequest('PHOTO_TOO_LARGE', `照片过大，最大支持 ${Math.floor(maxBytes / 1024 / 1024)}MB`);
        const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
        if (imageMime && !allowed.has(String(imageMime).toLowerCase())) throw badRequest('PHOTO_MIME_NOT_ALLOWED', '仅支持 jpg/png/webp/avif');

        imageSizeBytes = imageBuffer.length;
        try {
          const meta = await sharp(imageBuffer).metadata();
          if (Number.isFinite(meta?.width) && meta.width > 0) imageWidth = meta.width;
          if (Number.isFinite(meta?.height) && meta.height > 0) imageHeight = meta.height;
        } catch {
          imageWidth = null;
          imageHeight = null;
        }

        if (isObjectStorageEnabled()) {
          const key = createPhotoObjectKey({ photoId: id, mime: imageMime });
          const uploaded = await putPhotoObject({ key, buffer: imageBuffer, mime: imageMime });
          if (uploaded?.url) {
            imageUrl = uploaded.url;
            imageBytes = null;
          }

          try {
            const variants = await generatePhotoVariants(imageBuffer);
            const thumbKey = createVariantObjectKey({ photoId: id, variant: 'thumb', ext: variants.thumb.ext });
            const mediumKey = createVariantObjectKey({ photoId: id, variant: 'medium', ext: variants.medium.ext });
            const [thumbUploaded, mediumUploaded] = await Promise.all([
              putPhotoObject({ key: thumbKey, buffer: variants.thumb.buffer, mime: variants.thumb.mime }),
              putPhotoObject({ key: mediumKey, buffer: variants.medium.buffer, mime: variants.medium.mime }),
            ]);
            imageVariants = {
              thumb: thumbUploaded?.url || null,
              medium: mediumUploaded?.url || null,
            };
          } catch {
            imageVariants = null;
          }
        }
      }

      await pool.query(
        `
          update photos set
            title = coalesce($2, title),
            description = coalesce($3, description),
            category = coalesce($4, category),
            tags = coalesce($5, tags),
            exif = coalesce($6, exif),
            image_mime = coalesce($7, image_mime),
            image_bytes = coalesce($8, image_bytes),
            image_url = coalesce($9, image_url),
            image_variants = coalesce($10, image_variants),
            lat = coalesce($11, lat),
            lng = coalesce($12, lng),
            image_width = coalesce($13, image_width),
            image_height = coalesce($14, image_height),
            image_size_bytes = coalesce($15, image_size_bytes)
          where id = $1
        `,
        [id, title, description, category, tags, exif, imageMime, imageBytes, imageUrl, imageVariants, exif?.lat ?? null, exif?.lng ?? null, imageWidth, imageHeight, imageSizeBytes],
      );

      const detail = await pool.query(`${photoSelectSql(true)} where p.id = $1`, [id]);
      return reply.send(detail.rows[0]);
    },
  });

  app.post('/photos/:id/ai-critique', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
    },
    preHandler: requireAdmin(),
    handler: async (req) => {
      const id = String(req.params.id);
      const { buffer } = await getPhotoImage(id);

      const normalized = await sharp(buffer)
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();

      const aiCritique = await critiqueFromImage({ imageBase64: normalized.toString('base64'), mimeType: 'image/jpeg' });
      await pool.query('update photos set ai_critique = $2 where id = $1', [id, aiCritique]);
      return { ok: true, aiCritique };
    },
  });

  app.post('/photos/:id/ai-fill', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
    },
    preHandler: requireAdmin(),
    handler: async (req) => {
      const id = String(req.params.id);
      const { buffer, mime } = await getPhotoImage(id);
      const normalized = await sharp(buffer)
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82 })
        .toBuffer();
      const data = await fillFromImage({ imageBase64: normalized.toString('base64'), mimeType: 'image/jpeg' });
      return data;
    },
  });

  app.delete('/photos/:id/ai-critique', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
    },
    preHandler: requireAdmin(),
    handler: async (req) => {
      const id = String(req.params.id);
      const existing = await pool.query('select id from photos where id=$1', [id]);
      if (existing.rowCount === 0) throw notFound('PHOTO_NOT_FOUND', '照片不存在');
      await pool.query('update photos set ai_critique = null where id=$1', [id]);
      return { ok: true };
    },
  });

  app.delete('/photos/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
    },
    preHandler: requireAdmin(),
    handler: async (req) => {
      const id = String(req.params.id);
      const r = await pool.query('select image_url, image_variants from photos where id=$1', [id]);
      await pool.query('delete from photos where id=$1', [id]);
      if (r.rowCount) {
        const urls = [];
        if (r.rows[0]?.image_url) urls.push(String(r.rows[0].image_url));
        const variants = r.rows[0]?.image_variants || {};
        if (variants?.thumb) urls.push(String(variants.thumb));
        if (variants?.medium) urls.push(String(variants.medium));

        for (const u of urls) {
          deleteObjectByUrl(u).catch(() => {});
        }
      }
      return { ok: true };
    },
  });

  app.post('/photos/batch-delete', {
    schema: {
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'string' }, minItems: 1 }
        },
      },
    },
    preHandler: requireAdmin(),
    handler: async (req) => {
      const { ids } = req.body;
      const client = await pool.connect();
      try {
        await client.query('begin');
        
        // 获取所有要删除图片的 URL 信息以清理 S3
        const r = await client.query('select image_url, image_variants from photos where id = any($1)', [ids]);
        
        // 删除数据库记录
        await client.query('delete from photos where id = any($1)', [ids]);
        
        await client.query('commit');

        // 异步清理 S3
        for (const row of r.rows) {
          const urls = [];
          if (row.image_url) urls.push(String(row.image_url));
          const variants = row.image_variants || {};
          if (variants?.thumb) urls.push(String(variants.thumb));
          if (variants?.medium) urls.push(String(variants.medium));

          for (const u of urls) {
            deleteObjectByUrl(u).catch(() => {});
          }
        }
        
        return { ok: true, deletedCount: r.rowCount };
      } catch (e) {
        await client.query('rollback');
        throw e;
      } finally {
        client.release();
      }
    },
  });

  app.post('/photos/batch-update', {
    schema: {
      body: {
        type: 'object',
        required: ['ids'],
        properties: {
          ids: { type: 'array', items: { type: 'string' }, minItems: 1 },
          category: { type: 'string' },
          tags: { type: 'string' },
        },
      },
    },
    preHandler: requireAdmin(),
    handler: async (req) => {
      const { ids, category, tags } = req.body;
      
      let query = 'update photos set ';
      const params = [ids];
      const updates = [];
      
      if (category !== undefined) {
        updates.push(`category = $${params.length + 1}`);
        params.push(category);
      }
      
      if (tags !== undefined) {
        updates.push(`tags = $${params.length + 1}`);
        params.push(parseTags(tags));
      }
      
      if (updates.length === 0) throw badRequest('NO_UPDATES', '没有提供更新字段');
      
      query += updates.join(', ') + ' where id = any($1)';
      
      const r = await pool.query(query, params);
      return { ok: true, updatedCount: r.rowCount };
    },
  });

  app.post('/photos/:id/like', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
      body: {
        type: 'object',
        nullable: true,
        properties: {
          guestId: { type: 'string' }
        },
      }
    },
    handler: async (req) => {
      const id = String(req.params.id);
      const user = req.authUser;
      if (user) await upsertUser(user);

      const guestId = String(req.body?.guestId || '').trim();
      if (!user && !guestId) throw badRequest('GUEST_ID_REQUIRED', '需要登录或游客ID');

      const photoExists = await pool.query('select 1 from photos where id=$1', [id]);
      if (photoExists.rowCount === 0) throw notFound('PHOTO_NOT_FOUND', '照片不存在');

      const client = await pool.connect();
      try {
        await client.query('begin');
        let exists;
        if (user) {
          exists = await client.query('select 1 from photo_likes where photo_id=$1 and user_id=$2', [id, user.id]);
        } else {
          exists = await client.query('select 1 from photo_likes where photo_id=$1 and guest_id=$2', [id, guestId]);
        }

        if (exists.rowCount > 0) {
          if (user) {
            await client.query('delete from photo_likes where photo_id=$1 and user_id=$2', [id, user.id]);
          } else {
            await client.query('delete from photo_likes where photo_id=$1 and guest_id=$2', [id, guestId]);
          }
          await client.query('update photos set likes_count = greatest(likes_count - 1, 0) where id=$1', [id]);
        } else {
          if (user) {
            await client.query('insert into photo_likes(photo_id, user_id) values ($1,$2)', [id, user.id]);
          } else {
            await client.query('insert into photo_likes(photo_id, guest_id) values ($1,$2)', [id, guestId]);
          }
          await client.query('update photos set likes_count = likes_count + 1 where id=$1', [id]);
        }
        await client.query('commit');
      } catch (e) {
        await client.query('rollback');
        throw e;
      } finally {
        client.release();
      }

      const detail = await pool.query(`${photoSelectSql(true)} where p.id = $1`, [id]);
      return detail.rows[0];
    },
  });

  app.post('/photos/:id/comment', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1, maxLength: 2000 },
          guestId: { type: 'string', maxLength: 200 },
          nickname: { type: 'string' },
          email: { type: 'string' },
          captcha: { type: 'string' },
          captchaToken: { type: 'string' },
        },
      },
    },
    handler: async (req) => {
      const id = String(req.params.id);
      const user = req.authUser;
      if (user) await upsertUser(user);

      const photoExists = await pool.query('select 1 from photos where id=$1', [id]);
      if (photoExists.rowCount === 0) throw notFound('PHOTO_NOT_FOUND', '照片不存在');

      const content = String(req.body?.content ?? '').trim();
      if (!content) throw badRequest('CONTENT_REQUIRED', '评论内容不能为空');

      if (!user) {
        const guestId = String(req.body?.guestId || '').trim() || null;
        const nickname = String(req.body?.nickname || '').trim();
        const email = String(req.body?.email || '').trim();
        const captcha = String(req.body?.captcha || '').trim();
        const captchaToken = String(req.body?.captchaToken || '').trim();

        if (!nickname) throw badRequest('NICKNAME_REQUIRED', '游客昵称不能为空');
        if (!email) throw badRequest('EMAIL_REQUIRED', '游客邮箱不能为空');
        if (!captcha) throw badRequest('CAPTCHA_REQUIRED', '验证码不能为空');

        if (!verifyCaptcha(captcha, captchaToken)) {
          throw badRequest('CAPTCHA_INVALID', '验证码错误或已过期');
        }

        const ip = String(req.ip || '');
        const userAgent = String(req.headers?.['user-agent'] || '').slice(0, 1000);
        await pool.query(
          'insert into photo_comments(photo_id, guest_nickname, guest_email, guest_id, content, status, client_ip, user_agent) values ($1,$2,$3,$4,$5,$6,$7,$8)',
          [id, nickname, email, guestId, content, 'pending', ip, userAgent],
        );
      } else {
        await pool.query('insert into photo_comments(photo_id, user_id, content, status) values ($1,$2,$3,$4)', [id, user.id, content, 'approved']);
      }

      const detail = await pool.query(`${photoSelectSql(true)} where p.id = $1`, [id]);
      return detail.rows[0];
    },
  });
};
