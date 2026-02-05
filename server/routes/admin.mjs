import { pool } from '../db.mjs';
import { upsertUser } from '../db/users.mjs';
import { normalizeExif } from '../lib/exif.mjs';
import { parseTags, safeJsonParse } from '../lib/parsers.mjs';
import { badRequest } from '../lib/http_errors.mjs';
import { requireAdmin } from '../plugins/rbac.mjs';

export const registerAdminRoutes = async (app) => {
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

          if (url.startsWith('data:')) {
            const match = url.match(/^data:([^;]+);base64,(.*)$/);
            if (match) {
              imageMime = match[1];
              imageBytes = Buffer.from(match[2], 'base64');
            }
          } else if (url) {
            imageUrl = url;
          }

          await client.query(
            `
              insert into photos(id, owner_user_id, title, description, category, tags, exif, image_mime, image_bytes, image_url, created_at, updated_at, views_count, likes_count)
              values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13)
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
                likes_count = excluded.likes_count
            `,
            [id, user.id, title, description, category, tags, exif, imageMime, imageBytes, imageUrl, createdAt, viewsCount, likesCount],
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
};
