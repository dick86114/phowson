import pg from 'pg';
import { CURRENT_USER, MOCK_PHOTOS } from '../../constants';
import { loadEnvIfNeeded } from '../lib/load_env.mjs';

loadEnvIfNeeded();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('缺少 DATABASE_URL');

const normalizeExif = (raw: any) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const camera = source.camera ?? source.Model ?? '';
  const lens = source.lens ?? source.LensModel ?? '';
  const aperture = source.aperture ?? source.FNumber ?? '';
  const shutterSpeed = source.shutterSpeed ?? source.ExposureTime ?? '';
  const iso = source.iso ?? source.ISO ?? '';
  const focalLength = source.focalLength ?? source.FocalLength ?? '';
  const location = source.location ?? '';
  const lat = source.lat ?? null;
  const lng = source.lng ?? null;

  return {
    camera: String(camera || ''),
    lens: String(lens || ''),
    aperture: String(aperture || ''),
    shutterSpeed: String(shutterSpeed || ''),
    iso: String(iso || ''),
    focalLength: String(focalLength || ''),
    location: String(location || ''),
    Model: String(camera || ''),
    LensModel: String(lens || ''),
    FNumber: String(aperture || ''),
    ExposureTime: String(shutterSpeed || ''),
    ISO: String(iso || ''),
    FocalLength: String(focalLength || ''),
    lat,
    lng,
  };
};

const collectUsers = () => {
  const users = new Map<string, { id: string; name: string; role: string; avatar?: string }>();

  users.set(CURRENT_USER.id, {
    id: CURRENT_USER.id,
    name: CURRENT_USER.name,
    role: CURRENT_USER.role,
    avatar: CURRENT_USER.avatar,
  });

  for (const photo of MOCK_PHOTOS as any[]) {
    const ownerId = String(photo.userId || '').trim();
    if (ownerId && !users.has(ownerId)) {
      users.set(ownerId, {
        id: ownerId,
        name: `用户 ${ownerId}`,
        role: 'family',
      });
    }

    const comments = Array.isArray(photo.comments) ? photo.comments : [];
    for (const c of comments) {
      const u = c?.user;
      const id = String(u?.id ?? c?.userId ?? '').trim();
      if (!id) continue;
      if (!users.has(id)) {
        users.set(id, {
          id,
          name: String(u?.name ?? '访客'),
          role: String(u?.role ?? 'family') === 'admin' ? 'admin' : 'family',
          avatar: String(u?.avatar ?? ''),
        });
      }
    }
  }

  return Array.from(users.values());
};

const main = async () => {
  const { Pool } = pg;
  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query('begin');

    const users = collectUsers();
    for (const u of users) {
      await client.query(
        `
          insert into users(id, name, role, avatar_url)
          values ($1,$2,$3,$4)
          on conflict (id) do update set
            name = excluded.name,
            role = excluded.role,
            avatar_url = coalesce(users.avatar_url, excluded.avatar_url)
        `,
        [u.id, u.name, u.role, u.avatar || null],
      );
    }

    for (const p of MOCK_PHOTOS as any[]) {
      const createdAt = (() => {
        const d = p?.exif?.date;
        if (typeof d === 'string' && d.includes('-')) return new Date(d);
        return new Date();
      })();

      const exif = normalizeExif(p.exif || {});

      await client.query(
        `
          insert into photos(
            id, owner_user_id, title, description, category, tags, exif, image_url, views_count, likes_count, created_at, updated_at, lat, lng
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,$12,$13)
          on conflict (id) do update set
            owner_user_id = excluded.owner_user_id,
            title = excluded.title,
            description = excluded.description,
            category = excluded.category,
            tags = excluded.tags,
            exif = excluded.exif,
            image_url = coalesce(photos.image_url, excluded.image_url),
            views_count = excluded.views_count,
            likes_count = excluded.likes_count,
            created_at = excluded.created_at,
            lat = excluded.lat,
            lng = excluded.lng
        `,
        [
          String(p.id),
          String(p.userId || CURRENT_USER.id),
          String(p.title || '未命名'),
          String(p.description || ''),
          String(p.category || 'uncategorized'),
          Array.isArray(p.tags) ? p.tags.map((t: any) => String(t)) : [],
          exif,
          String(p.url || ''),
          Number(p.views || 0),
          Number(p.likes || 0),
          createdAt,
          exif.lat,
          exif.lng,
        ],
      );

      const comments = Array.isArray(p.comments) ? p.comments : [];
      for (const c of comments) {
        const content = String(c?.content ?? '').trim();
        if (!content) continue;
        const userId = String(c?.userId ?? c?.user?.id ?? 'family');
        await client.query(
          `
            insert into photo_comments(id, photo_id, user_id, content, created_at)
            values ($1,$2,$3,$4,now())
            on conflict (id) do update set
              content = excluded.content
          `,
          [String(c?.id ?? `${p.id}-${userId}-${Math.random()}`), String(p.id), userId, content],
        );
      }
    }

    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
};

await main();
