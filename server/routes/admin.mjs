import { pool } from '../db.mjs';
import { badRequest, notFound } from '../lib/http_errors.mjs';
import { requireAdmin } from '../plugins/rbac.mjs';
import { fillFromImage, translateText } from '../lib/ai_provider.mjs';
import sharp from 'sharp';
import crypto from 'node:crypto';
import { putPhotoObject, isObjectStorageEnabled } from '../lib/object_storage.mjs';

export const registerAdminRoutes = async (app) => {
  const ensureTables = async () => {
    await pool.query(`
      create table if not exists site_settings (
        id text primary key,
        data jsonb not null default '{}'::jsonb,
        updated_at timestamptz default now(),
        updated_by text
      );
      create table if not exists files (
        id text primary key,
        mime text,
        data bytea,
        created_at timestamptz default now(),
        created_by text
      );
    `);
  };
  await ensureTables();

  const parseBool = (v, defaultValue) => {
    if (v === undefined || v === null || v === '') return defaultValue;
    const s = String(v).toLowerCase();
    if (s === '1' || s === 'true' || s === 'yes' || s === 'y') return true;
    if (s === '0' || s === 'false' || s === 'no' || s === 'n') return false;
    return defaultValue;
  };

  // Public settings
  app.get('/site-settings', async (req) => {
    const r = await pool.query(`select data from site_settings where id = 'global'`);
    return r.rows?.[0]?.data || {};
  });

  // Admin settings
  app.get('/admin/site-settings', {
    preHandler: requireAdmin(),
    handler: async (req) => {
      const r = await pool.query(`select data from site_settings where id = 'global'`);
      return r.rows?.[0]?.data || {};
    },
  });

  app.post('/admin/site-settings', {
    preHandler: requireAdmin(),
    schema: {
      body: {
        type: 'object',
        properties: {
          siteName: { type: 'string' },
          siteLogo: { type: 'string' },
          documentTitle: { type: 'string' },
          favicon: { type: 'string' },
          defaultTheme: { type: 'string' },
        },
      },
    },
    handler: async (req) => {
      const data = req.body;
      const user = req.authUser;
      await pool.query(
        `insert into site_settings (id, data, updated_by, updated_at)
         values ('global', $1, $2, now())
         on conflict (id) do update set
           data = $1,
           updated_by = $2,
           updated_at = now()`,
        [data, user?.id || null]
      );
      return { ok: true };
    },
  });

  // Admin upload
  app.post('/admin/upload', {
    preHandler: requireAdmin(),
    handler: async (req) => {
      if (!req.isMultipart()) throw badRequest('INVALID_CONTENT_TYPE', '需要 multipart/form-data');
      const part = await req.file();
      if (!part) throw badRequest('NO_FILE', '未上传文件');

      const buffer = await part.toBuffer();
      const mime = part.mimetype;
      const ext = mime.split('/')[1] || 'bin';
      const user = req.authUser;
      
      if (isObjectStorageEnabled()) {
        const key = `uploads/${crypto.randomBytes(8).toString('hex')}.${ext}`;
        const res = await putPhotoObject({ key, buffer, mime });
        return { url: res.url };
      } else {
        const id = crypto.randomBytes(8).toString('hex');
        await pool.query(
          `insert into files (id, mime, data, created_by) values ($1, $2, $3, $4)`,
          [id, mime, buffer, user?.id || null]
        );
        return { url: `/media/files/${id}` };
      }
    }
  });

  app.get('/admin/comments/summary', {
    preHandler: requireAdmin(),
    handler: async () => {
      const r = await pool.query(
        `
          select
            count(*) filter (where pc.status = 'pending' and pc.user_id is null) as "pendingGuestCount"
          from photo_comments pc
        `,
      );
      return {
        pendingGuestCount: Number(r.rows?.[0]?.pendingGuestCount ?? 0) || 0,
      };
    },
  });

  app.get('/admin/comments', {
    preHandler: requireAdmin(),
    schema: {
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          onlyGuest: { type: 'string' },
          photoId: { type: 'string' },
          q: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 200 },
          offset: { type: 'integer', minimum: 0 },
        },
      },
    },
    handler: async (req) => {
      const status = String(req.query?.status ?? 'pending').trim() || 'pending';
      const onlyGuest = parseBool(req.query?.onlyGuest, true);
      const photoId = String(req.query?.photoId ?? '').trim() || null;
      const q = String(req.query?.q ?? '').trim() || null;
      const limit = Math.max(1, Math.min(200, Number(req.query?.limit ?? 50) || 50));
      const offset = Math.max(0, Number(req.query?.offset ?? 0) || 0);

      const allowedStatus = new Set(['pending', 'approved', 'rejected', 'all']);
      if (!allowedStatus.has(status)) throw badRequest('STATUS_INVALID', 'status 不合法');

      const where = [];
      const args = [];
      let i = 1;

      if (status !== 'all') {
        where.push(`pc.status = $${i++}`);
        args.push(status);
      }
      if (onlyGuest) {
        where.push(`pc.user_id is null`);
      }
      if (photoId) {
        where.push(`pc.photo_id = $${i++}`);
        args.push(photoId);
      }
      if (q) {
        where.push(`(pc.content ilike $${i} or pc.guest_nickname ilike $${i} or pc.guest_email ilike $${i})`);
        args.push(`%${q}%`);
        i += 1;
      }

      const whereSql = where.length ? `where ${where.join(' and ')}` : '';
      const countRes = await pool.query(
        `
          select count(*)::int as total
          from photo_comments pc
          ${whereSql}
        `,
        args,
      );
      const total = Number(countRes.rows?.[0]?.total ?? 0) || 0;

      const itemsArgs = [...args, limit, offset];
      const itemsRes = await pool.query(
        `
          select
            pc.id,
            pc.photo_id as "photoId",
            p.title as "photoTitle",
            pc.content,
            pc.created_at as "createdAt",
            pc.user_id as "userId",
            pc.guest_id as "guestId",
            pc.guest_nickname as "guestNickname",
            pc.guest_email as "guestEmail",
            pc.status,
            pc.reviewed_by as "reviewedBy",
            pc.reviewed_at as "reviewedAt",
            pc.review_reason as "reviewReason",
            pc.client_ip as "clientIp",
            pc.user_agent as "userAgent"
          from photo_comments pc
          join photos p on p.id = pc.photo_id
          ${whereSql}
          order by pc.created_at desc
          limit $${i} offset $${i + 1}
        `,
        itemsArgs,
      );

      return {
        items: itemsRes.rows || [],
        total,
        limit,
        offset,
      };
    },
  });

  app.patch('/admin/comments/:id', {
    preHandler: requireAdmin(),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string' },
          reason: { type: 'string', maxLength: 2000 },
        },
      },
    },
    handler: async (req) => {
      const id = String(req.params.id);
      const user = req.authUser;
      const status = String(req.body?.status ?? '').trim();
      const reason = String(req.body?.reason ?? '').trim() || null;

      const allowedStatus = new Set(['pending', 'approved', 'rejected']);
      if (!allowedStatus.has(status)) throw badRequest('STATUS_INVALID', 'status 不合法');

      const r = await pool.query(
        `
          update photo_comments
          set
            status = $1,
            reviewed_by = $2,
            reviewed_at = now(),
            review_reason = $3
          where id = $4
          returning
            id,
            photo_id as "photoId",
            content,
            created_at as "createdAt",
            user_id as "userId",
            guest_id as "guestId",
            guest_nickname as "guestNickname",
            guest_email as "guestEmail",
            status,
            reviewed_by as "reviewedBy",
            reviewed_at as "reviewedAt",
            review_reason as "reviewReason"
        `,
        [status, user?.id || null, reason, id],
      );
      if (!r.rowCount) throw notFound('COMMENT_NOT_FOUND', '评论不存在');
      return r.rows[0];
    },
  });

  app.delete('/admin/comments/:id', {
    preHandler: requireAdmin(),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
    },
    handler: async (req) => {
      const id = String(req.params.id);
      const r = await pool.query('delete from photo_comments where id=$1 returning id', [id]);
      if (!r.rowCount) throw notFound('COMMENT_NOT_FOUND', '评论不存在');
      return { ok: true };
    },
  });

  app.post('/admin/comments/translate', {
    preHandler: requireAdmin(),
    schema: {
      body: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string', minLength: 1, maxLength: 5000 },
        },
      },
    },
    handler: async (req) => {
      const text = String(req.body.text);
      const translated = await translateText({ text });
      return { translated };
    },
  });

  app.post('/admin/photos/backfill-image-meta', {
    preHandler: requireAdmin(),
    schema: {
      body: {
        type: 'object',
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 500 },
        },
      },
    },
    handler: async (req) => {
      const limit = Math.max(1, Math.min(500, Number(req.body?.limit ?? 200) || 200));
      const idsRes = await pool.query(
        `
          select id
          from photos
          where image_size_bytes is null
             or image_width is null
             or image_height is null
          order by created_at desc
          limit $1
        `,
        [limit],
      );
      const ids = (idsRes.rows || []).map((r) => String(r.id));

      let updated = 0;
      let skipped = 0;
      let failed = 0;

      for (const id of ids) {
        try {
          const { buffer } = await getPhotoImage(id);
          const imageSizeBytes = buffer.length;
          let imageWidth = null;
          let imageHeight = null;
          try {
            const meta = await sharp(buffer).metadata();
            if (Number.isFinite(meta?.width) && meta.width > 0) imageWidth = meta.width;
            if (Number.isFinite(meta?.height) && meta.height > 0) imageHeight = meta.height;
          } catch {
            imageWidth = null;
            imageHeight = null;
          }
          const r = await pool.query(
            `
              update photos
              set
                image_width = coalesce(image_width, $2),
                image_height = coalesce(image_height, $3),
                image_size_bytes = coalesce(image_size_bytes, $4)
              where id = $1
            `,
            [id, imageWidth, imageHeight, imageSizeBytes],
          );
          if (r.rowCount) updated += 1;
          else skipped += 1;
        } catch {
          failed += 1;
        }
      }

      return { ok: true, limit, processed: ids.length, updated, skipped, failed };
    },
  });
};
