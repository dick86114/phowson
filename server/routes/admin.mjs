import { pool } from '../db.mjs';
import { upsertUser } from '../db/users.mjs';
import { normalizeExif } from '../lib/exif.mjs';
import { parseTags, safeJsonParse } from '../lib/parsers.mjs';
import { badRequest, notFound } from '../lib/http_errors.mjs';
import { requireAdmin } from '../plugins/rbac.mjs';
import { fillFromImage, translateText } from '../lib/ai_provider.mjs';
import sharp from 'sharp';

export const registerAdminRoutes = async (app) => {
  const parseBool = (v, defaultValue) => {
    if (v === undefined || v === null || v === '') return defaultValue;
    const s = String(v).toLowerCase();
    if (s === '1' || s === 'true' || s === 'yes' || s === 'y') return true;
    if (s === '0' || s === 'false' || s === 'no' || s === 'n') return false;
    return defaultValue;
  };

  const ensureSiteSettingsTables = async () => {
    await pool.query(`
      create table if not exists site_settings (
        id text primary key,
        data jsonb not null default '{}'::jsonb,
        updated_at timestamptz default now(),
        updated_by text
      );
      create table if not exists site_settings_versions (
        id bigserial primary key,
        settings_id text not null,
        data jsonb not null,
        created_at timestamptz default now(),
        created_by text
      );
      create index if not exists idx_site_settings_versions_settings_id on site_settings_versions(settings_id);
    `);
  };

  app.get('/site-settings', {
    handler: async () => {
      await ensureSiteSettingsTables();
      const r = await pool.query(`select data from site_settings where id='global'`);
      const data = r.rows?.[0]?.data || {};
      return {
        siteName: String(data.siteName ?? 'Phowson - 浮生'),
        logoUrl: data.logoUrl ?? '',
        seo: {
          title: String(data?.seo?.title ?? 'Phowson'),
          description: String(data?.seo?.description ?? 'AI 驱动的智能摄影日志'),
          keywords: String(data?.seo?.keywords ?? '摄影,AI,日志'),
        },
        theme: {
          mode: String(data?.theme?.mode ?? 'system'),
          colorPrimary: String(data?.theme?.colorPrimary ?? '#137fec'),
        },
      };
    },
  });

  app.post('/admin/site-settings', {
    preHandler: requireAdmin(),
    schema: {
      body: {
        type: 'object',
        required: ['siteName'],
        properties: {
          siteName: { type: 'string', minLength: 1, maxLength: 200 },
          logoUrl: { type: 'string' },
          seo: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              description: { type: 'string' },
              keywords: { type: 'string' },
            },
          },
          theme: {
            type: 'object',
            properties: {
              mode: { type: 'string' },
              colorPrimary: { type: 'string' },
            },
          },
        },
      },
    },
    handler: async (req) => {
      const user = req.authUser;
      await ensureSiteSettingsTables();
      const client = await pool.connect();
      try {
        await client.query('begin');
        const prev = await client.query(`select data from site_settings where id='global'`);
        if (prev.rowCount) {
          await client.query(
            `insert into site_settings_versions(settings_id, data, created_by) values ($1,$2,$3)`,
            ['global', prev.rows[0].data || {}, user?.id || null],
          );
        }
        const data = {
          siteName: String(req.body?.siteName ?? 'Phowson - 浮生'),
          logoUrl: String(req.body?.logoUrl ?? ''),
          seo: {
            title: String(req.body?.seo?.title ?? ''),
            description: String(req.body?.seo?.description ?? ''),
            keywords: String(req.body?.seo?.keywords ?? ''),
          },
          theme: {
            mode: String(req.body?.theme?.mode ?? 'system'),
            colorPrimary: String(req.body?.theme?.colorPrimary ?? '#137fec'),
          },
        };
        await client.query(
          `
            insert into site_settings(id, data, updated_at, updated_by)
            values ('global', $1, now(), $2)
            on conflict (id) do update set
              data = excluded.data,
              updated_at = excluded.updated_at,
              updated_by = excluded.updated_by
          `,
          [data, user?.id || null],
        );
        await client.query('commit');
        return { ok: true, data };
      } catch (e) {
        await client.query('rollback');
        throw e;
      } finally {
        client.release();
      }
    },
  });

  app.post('/admin/site-settings/rollback', {
    preHandler: requireAdmin(),
    handler: async (req) => {
      const user = req.authUser;
      await ensureSiteSettingsTables();
      const client = await pool.connect();
      try {
        await client.query('begin');
        const r = await client.query(
          `select id, data from site_settings_versions where settings_id='global' order by id desc limit 1`,
        );
        if (!r.rowCount) {
          await client.query('rollback');
          return { ok: false, message: '没有可回滚的版本' };
        }
        const data = r.rows[0].data || {};
        await client.query(
          `
            insert into site_settings(id, data, updated_at, updated_by)
            values ('global', $1, now(), $2)
            on conflict (id) do update set
              data = excluded.data,
              updated_at = excluded.updated_at,
              updated_by = excluded.updated_by
          `,
          [data, user?.id || null],
        );
        await client.query(`delete from site_settings_versions where id=$1`, [r.rows[0].id]);
        await client.query('commit');
        return { ok: true, data };
      } catch (e) {
        await client.query('rollback');
        throw e;
      } finally {
        client.release();
      }
    },
  });

  app.post('/admin/migrate/localstorage', {
    preHandler: requireAdmin(),
    schema: {
      body: {
        type: 'object',
        required: ['photos'],
        properties: {
          photos: { type: 'array' },
        },
      },
    },
    handler: async (req) => {
      const user = req.authUser;
      await upsertUser(user);

      const payload = req.body ?? {};
      const photos = Array.isArray(payload.photos) ? payload.photos : [];
      if (photos.length === 0) throw badRequest('PHOTOS_REQUIRED', '缺少 photos');

      const client = await pool.connect();
      try {
        await client.query('begin');
        for (const p of photos) {
          const id = String(p.id ?? '').trim();
          if (!id) continue;
          const title = String(p.title ?? '未命名');
          const description = String(p.description ?? '');
          const category = String(p.category ?? 'uncategorized');
          const tags = parseTags(p.tags);
          const exif = normalizeExif(safeJsonParse(p.exif, {}));
          const createdAt = p.createdAt ? new Date(p.createdAt) : new Date();
          const viewsCount = Number(p.viewsCount ?? 0);
          const likesCount = Number(p.likesCount ?? 0);

          const url = String(p.url ?? '');
          let imageBytes = null;
          let imageMime = null;
          let imageUrl = null;
          let imageWidth = null;
          let imageHeight = null;
          let imageSizeBytes = null;

          if (url.startsWith('data:')) {
            const match = url.match(/^data:([^;]+);base64,(.*)$/);
            if (match) {
              imageMime = match[1];
              imageBytes = Buffer.from(match[2], 'base64');
            }
          } else if (url) {
            imageUrl = url;
          }

          if (imageBytes) {
            imageSizeBytes = imageBytes.length;
            try {
              const meta = await sharp(imageBytes).metadata();
              if (Number.isFinite(meta?.width) && meta.width > 0) imageWidth = meta.width;
              if (Number.isFinite(meta?.height) && meta.height > 0) imageHeight = meta.height;
            } catch {
              imageWidth = null;
              imageHeight = null;
            }
          }

          await client.query(
            `
              insert into photos(id, owner_user_id, title, description, category, tags, exif, image_mime, image_bytes, image_url, created_at, updated_at, views_count, likes_count, image_width, image_height, image_size_bytes)
              values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13,$14,$15,$16)
              on conflict (id) do update set
                owner_user_id = excluded.owner_user_id,
                title = excluded.title,
                description = excluded.description,
                category = excluded.category,
                tags = excluded.tags,
                exif = excluded.exif,
                image_mime = coalesce(excluded.image_mime, photos.image_mime),
                image_bytes = coalesce(excluded.image_bytes, photos.image_bytes),
                image_url = coalesce(excluded.image_url, photos.image_url),
                created_at = excluded.created_at,
                views_count = excluded.views_count,
                likes_count = excluded.likes_count,
                image_width = coalesce(excluded.image_width, photos.image_width),
                image_height = coalesce(excluded.image_height, photos.image_height),
                image_size_bytes = coalesce(excluded.image_size_bytes, photos.image_size_bytes)
            `,
            [id, user.id, title, description, category, tags, exif, imageMime, imageBytes, imageUrl, createdAt, viewsCount, likesCount, imageWidth, imageHeight, imageSizeBytes],
          );

          const comments = Array.isArray(p.comments) ? p.comments : [];
          for (const c of comments) {
            const cid = String(c.id ?? '').trim() || null;
            const content = String(c.content ?? '').trim();
            if (!content) continue;
            const cu = c.user ?? {};
            const commentUserId = String(c.userId ?? cu.id ?? 'family').trim() || 'family';
            const commentUserName = String(cu.name ?? c.userName ?? '家庭成员');
            const commentUserAvatar = String(cu.avatar ?? c.userAvatar ?? '');
            await client.query(
              `
                insert into users(id, name, role, avatar_url)
                values ($1,$2,$3,$4)
                on conflict (id) do update set
                  name = excluded.name,
                  role = excluded.role,
                  avatar_url = coalesce(users.avatar_url, excluded.avatar_url)
              `,
              [commentUserId, commentUserName, String(cu.role ?? 'family') === 'admin' ? 'admin' : 'family', commentUserAvatar || null],
            );

            const created = c.createdAt ? new Date(c.createdAt) : new Date();
            if (cid) {
              await client.query(
                `
                  insert into photo_comments(id, photo_id, user_id, content, created_at)
                  values ($1,$2,$3,$4,$5)
                  on conflict (id) do update set
                    content = excluded.content,
                    created_at = excluded.created_at
                `,
                [cid, id, commentUserId, content, created],
              );
            } else {
              await client.query('insert into photo_comments(photo_id, user_id, content, created_at) values ($1,$2,$3,$4)', [id, commentUserId, content, created]);
            }
          }
        }
        await client.query('commit');
      } catch (e) {
        await client.query('rollback');
        throw e;
      } finally {
        client.release();
      }

      return { ok: true, count: photos.length };
    },
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
