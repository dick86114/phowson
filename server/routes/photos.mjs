import { pool } from '../db.mjs';
import { upsertUser } from '../db/users.mjs';
import { photoSelectSql } from '../db/photos_sql.mjs';
import { normalizeExif } from '../lib/exif.mjs';
import { reverseGeocode } from '../lib/geocoding.mjs';
import exifr from 'exifr';
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
import { checkChallengesOnUpload } from '../db/challenges.mjs';
import { verifyCaptcha } from '../lib/captcha.mjs';
import { buildMePhotosWhere, parseListParam } from '../lib/me_photos.mjs';
import fs from 'node:fs';
import path from 'node:path';

const localDayIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseMonthDay = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim();
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(s);
  if (!m) return null;
  const month = Number.parseInt(m[1], 10);
  const day = Number.parseInt(m[2], 10);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  if (!Number.isFinite(day) || day < 1 || day > 31) return null;
  return { month, day };
};

const ensureMultipart = (req) => {
  if (!req.isMultipart()) throw badRequest('INVALID_CONTENT_TYPE', '需要 multipart/form-data');
};

export const registerPhotoRoutes = async (app) => {
  app.get('/admin/photos/filters', { preHandler: requireAdmin() }, async () => {
    const tagsRes = await pool.query(
      `
        select distinct t as tag
        from photos p
        cross join unnest(p.tags) t
        where t is not null
          and t <> ''
        order by t asc
      `,
    );

    const camerasRes = await pool.query(
      `
        select distinct nullif(p.exif->>'Model','') as model
        from photos p
        where nullif(p.exif->>'Model','') is not null
        order by model asc
      `,
    );

    return {
      tags: (tagsRes.rows || []).map((r) => r.tag),
      cameras: (camerasRes.rows || []).map((r) => r.model),
    };
  });

  app.get('/admin/photos/page', { preHandler: requireAdmin() }, async (req) => {
    const q = req.query || {};
    const limitRaw = q.limit ?? q.pageSize ?? 50;
    const offsetRaw = q.offset ?? 0;
    // Allow larger limit for export (max 10000), default 50
    const limit = Math.max(1, Math.min(10000, Number.parseInt(String(limitRaw), 10) || 50));
    const offset = Math.max(0, Number.parseInt(String(offsetRaw), 10) || 0);

    const from = String(q.from ?? '').trim();
    const to = String(q.to ?? '').trim();
    const tags = parseListParam(q.tags);
    const camera = String(q.camera ?? '').trim();
    const category = String(q.category ?? '').trim();
    const ownerId = String(q.ownerId ?? '').trim();
    const keyword = String(q.q ?? q.keyword ?? '').trim();
    
    const sortBy = String(q.sortBy ?? 'createdAt').trim();
    const order = String(q.order ?? 'desc').toLowerCase() === 'asc' ? 'asc' : 'desc';

    const parts = [];
    const params = [];
    let i = 1;

    if (ownerId && ownerId !== 'all') {
      parts.push(`p.owner_user_id = $${i++}`);
      params.push(ownerId);
    }

    if (category && category !== 'all') {
      parts.push(`p.category = $${i++}`);
      params.push(category);
    }

    if (from) {
      parts.push(`p.created_at >= $${i++}::date`);
      params.push(from);
    }
    
    if (to) {
      parts.push(`p.created_at < ($${i++}::date + interval '1 day')`);
      params.push(to);
    }

    if (Array.isArray(tags) && tags.length > 0) {
      parts.push(`p.tags && $${i++}::text[]`);
      params.push(tags);
    }

    if (camera && camera !== 'all') {
      parts.push(`coalesce(p.exif->>'Model','') ilike $${i++}`);
      params.push(`%${camera}%`);
    }

    if (keyword) {
      parts.push(`(p.id ilike $${i} or p.title ilike $${i} or p.description ilike $${i} or array_to_string(p.tags, ',') ilike $${i})`);
      params.push(`%${keyword}%`);
      i += 1;
    }

    const whereSql = parts.length ? ` where ${parts.join(' and ')}` : '';

    // Map frontend sort fields to DB columns
    const sortMap = {
      'title': 'p.title',
      'category': 'p.category',
      'createdAt': 'p.created_at',
      'imageWidth': 'p.image_width',
      'imageHeight': 'p.image_height',
      'imageSizeBytes': 'p.image_size_bytes',
      'viewsCount': 'p.views_count',
      'likesCount': 'p.likes_count',
      'commentsCount': "json_array_length(coalesce(c.comments, '[]'::json))"
    };
    const dbSortField = sortMap[sortBy] || 'p.created_at';
    
    const itemsSql = `${photoSelectSql(false)}${whereSql} order by ${dbSortField} ${order} limit $${params.length + 1} offset $${params.length + 2}`;
    const itemsRes = await pool.query(itemsSql, [...params, limit, offset]);

    const totalSql = `select count(1)::int as total from photos p${whereSql}`;
    const totalRes = await pool.query(totalSql, params);
    const total = Number(totalRes.rows?.[0]?.total || 0);

    return {
      items: itemsRes.rows || [],
      limit,
      offset,
      total,
    };
  });

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
    const sinceRaw = q.since;
    let sinceIso = null;
    if (sinceRaw !== undefined && sinceRaw !== null && String(sinceRaw).trim() !== '') {
      const ms = Date.parse(String(sinceRaw));
      if (!Number.isFinite(ms)) throw badRequest('INVALID_SINCE', 'since 参数格式错误');
      sinceIso = new Date(ms).toISOString();
    }

    if (sinceIso) {
      const itemsSql = `${photoSelectSql(false)} where p.updated_at > $1 order by p.updated_at asc, p.id asc limit $2 offset $3`;
      const itemsRes = await pool.query(itemsSql, [sinceIso, limit, offset]);
      const totalRes = await pool.query('select count(1)::int as total from photos where updated_at > $1', [sinceIso]);
      const total = Number(totalRes.rows?.[0]?.total || 0);
      const items = itemsRes.rows || [];
      const nextOffset = offset + items.length;
      const nextSince = items.length ? String(items[items.length - 1]?.updatedAt ?? sinceIso) : sinceIso;

      return {
        items,
        limit,
        offset,
        total,
        hasMore: nextOffset < total,
        nextOffset,
        since: sinceIso,
        nextSince,
      };
    }

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

  app.get('/me/photos/filters', { preHandler: requireMember() }, async (req) => {
    const user = req.authUser;

    const tagsRes = await pool.query(
      `
        select distinct t as tag
        from photos p
        cross join unnest(p.tags) t
        where p.owner_user_id = $1
          and t is not null
          and t <> ''
        order by t asc
      `,
      [user.id],
    );

    const camerasRes = await pool.query(
      `
        select distinct trim(nullif(p.exif->>'Model','')) as model
        from photos p
        where p.owner_user_id = $1
          and nullif(p.exif->>'Model','') is not null
        order by model asc
      `,
      [user.id],
    );

    const monthsRes = await pool.query(
      `
        select distinct to_char(created_at, 'YYYY-MM') as value, to_char(created_at, 'YYYY年FMMM月') as label
        from photos
        where owner_user_id = $1
        order by value desc
      `,
      [user.id],
    );

    return {
      tags: (tagsRes.rows || []).map((r) => r.tag),
      cameras: (camerasRes.rows || []).map((r) => r.model),
      months: monthsRes.rows || [],
    };
  });

  app.get('/me/photos/page', { preHandler: requireMember() }, async (req) => {
    const user = req.authUser;
    req.log.info({ user_id: user.id, query: req.query }, 'Debugging /me/photos/page request');
    const q = req.query || {};
    const limitRaw = q.limit ?? q.pageSize ?? 24;
    const offsetRaw = q.offset ?? 0;
    const limit = Math.max(1, Math.min(50, Number.parseInt(String(limitRaw), 10) || 24));
    const offset = Math.max(0, Number.parseInt(String(offsetRaw), 10) || 0);

    const yearRaw = q.year;
    const year = Number.parseInt(String(yearRaw ?? ''), 10);
    const monthRaw = q.month;
    const monthParsed = Number.parseInt(String(monthRaw ?? ''), 10);
    const category = String(q.category ?? 'all');
    const tags = parseListParam(q.tags);
    const camera = String(q.camera ?? '').trim();

    let filterMonth = Number.isFinite(monthParsed) ? monthParsed : null;
    let filterDay = null;
    let excludeYear = null;

    if (q.onThisDay) {
        const d = new Date();
        filterMonth = d.getMonth() + 1;
        filterDay = d.getDate();
        excludeYear = d.getFullYear();
    }

    const { whereSql, params } = buildMePhotosWhere({
      userId: user.id,
      year: Number.isFinite(year) ? year : null,
      month: filterMonth,
      day: filterDay,
      excludeYear,
      category: category === 'all' ? null : category,
      tags,
      camera: camera || null,
    });

    req.log.info({ whereSql, params, userId: user.id }, 'Executing MePhotos query');

    const itemsSql = `${photoSelectSql(false)}${whereSql} order by p.created_at desc limit $${params.length + 1} offset $${params.length + 2}`;
    const itemsRes = await pool.query(itemsSql, [...params, limit, offset]);

    const totalSql = `select count(1)::int as total from photos p${whereSql}`;
    const totalRes = await pool.query(totalSql, params);
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
    let exif = normalizeExif(safeJsonParse(fields.exif, {}));

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

    // Try to extract GPS from buffer if not provided by frontend
    if (exif.lat == null || exif.lng == null) {
      try {
        const bufferExif = await exifr.parse(imageBuffer);
        if (bufferExif && typeof bufferExif.latitude === 'number' && typeof bufferExif.longitude === 'number') {
          exif.lat = bufferExif.latitude;
          exif.lng = bufferExif.longitude;
          req.log.info({ photoId: id, lat: exif.lat, lng: exif.lng }, 'GPS extracted from buffer');
        }
      } catch (err) {
        req.log.warn({ err }, 'Failed to parse EXIF from buffer');
      }
    }

    // Reverse Geocoding if location is missing but GPS is available
    if ((!exif.location || exif.location === '') && exif.lat != null && exif.lng != null) {
      const locationName = await reverseGeocode(exif.lat, exif.lng);
      if (locationName) {
        exif.location = locationName;
        req.log.info({ photoId: id, location: locationName }, 'Geocoded location');
      }
    }

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
      const newCount = await bumpUploadActivity({ userId: user.id, day: localDayIso() });
      req.log.info('Activity log updated');

      // Update gamification challenges
      try {
        await checkChallengesOnUpload(user.id, category, newCount === 1);
      } catch (ce) {
        req.log.error({ err: ce }, 'Failed to update challenges');
      }
    } catch (err) {
      req.log.error({ err }, 'Failed to update activity log');
    }

    const detail = await pool.query(`${photoSelectSql(true)} where p.id = $1`, [createdId]);
    req.log.info('Photo detail fetched, sending response');



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
      
      if (exif && (!exif.location || exif.location === '') && exif.lat != null && exif.lng != null) {
        const locationName = await reverseGeocode(exif.lat, exif.lng);
        if (locationName) {
          exif.location = locationName;
        }
      }

      const createdAt = fields.created_at != null ? String(fields.created_at).trim() : null;

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
            image_size_bytes = coalesce($15, image_size_bytes),
            created_at = coalesce($16, created_at)
          where id = $1
        `,
        [id, title, description, category, tags, exif, imageMime, imageBytes, imageUrl, imageVariants, exif?.lat ?? null, exif?.lng ?? null, imageWidth, imageHeight, imageSizeBytes, createdAt],
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

  app.post('/admin/photos/batch-delete', {
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

  app.post('/admin/photos/batch-category', {
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

      // Auto-detect spam
      const spamKeywords = ['http://', 'https://', 'www.', '.com', '.cn', '.net', '.org', '关注我', '互粉', '加微信', '加qq', '加Q', '代开', '发票'];
      const isSpam = spamKeywords.some(k => content.toLowerCase().includes(k.toLowerCase()));
      const initialStatus = isSpam ? 'rejected' : 'pending';
      const reviewReason = isSpam ? 'System auto-flagged: contains link/keywords' : null;

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
          'insert into photo_comments(photo_id, guest_nickname, guest_email, guest_id, content, status, review_reason, client_ip, user_agent) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [id, nickname, email, guestId, content, initialStatus, reviewReason, ip, userAgent],
        );
      } else {
        await pool.query('insert into photo_comments(photo_id, user_id, content, status, review_reason) values ($1,$2,$3,$4,$5)', [id, user.id, content, initialStatus, reviewReason]);
      }

      const detail = await pool.query(`${photoSelectSql(true)} where p.id = $1`, [id]);
      return detail.rows[0];
    },
  });
};
