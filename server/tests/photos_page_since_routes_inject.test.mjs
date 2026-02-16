import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../app.mjs';
import { pool } from '../db.mjs';
import { generateToken, hashToken } from '../lib/tokens.mjs';

const app = createApp();
await app.ready();

const userId = `test-visibility-${crypto.randomUUID()}`;
const headers = {
  'x-user-id': userId,
  'x-user-name': 'Visibility Test',
  'x-user-role': 'family',
  'x-user-avatar': '',
};
const adminHeaders = {
  'x-user-id': `test-admin-${crypto.randomUUID()}`,
  'x-user-name': 'Admin Test',
  'x-user-role': 'admin',
  'x-user-avatar': '',
};

const publicPhotoId = `test-public-${crypto.randomUUID()}`;
const privatePhotoId = `test-private-${crypto.randomUUID()}`;
const img = Buffer.from('ffd8ffe000104a46494600010100000100010000ffdb00430001010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101010101ffc00011080001000103012200021101031101ffc4001400010000000000000000000000000000000000ffc4001410010000000000000000000000000000000000ffda000c03010002110311003f00d2cf20ffd9', 'hex');
const sessionToken = generateToken();
const sessionTokenHash = hashToken(sessionToken);

await pool.query('insert into users(id, name, role) values ($1,$2,$3) on conflict (id) do nothing', [userId, 'Visibility Test', 'family']);
await pool.query(`insert into sessions(token_hash, user_id, expires_at) values ($1,$2, now() + interval '1 day')`, [sessionTokenHash, userId]);
await pool.query(
  `
    insert into photos(id, owner_user_id, title, description, category, is_public, image_mime, image_bytes, created_at, updated_at)
    values
      ($1,$2,$3,$4,$5,true,$6,$7,'2000-01-01T00:00:00.000Z','2000-01-02T00:00:00.000Z'),
      ($8,$2,$9,$10,$11,false,$6,$7,'2000-01-01T00:00:00.000Z','2000-01-02T00:00:00.000Z')
  `,
  [publicPhotoId, userId, 'public', '', 'uncategorized', 'image/jpeg', img, privatePhotoId, 'private', '', 'uncategorized'],
);

{
  const res = await app.inject({ method: 'GET', url: '/photos/page?since=1999-01-01T00:00:00.000Z&limit=50&offset=0' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  const ids = (body.items || []).map((x) => String(x?.id || ''));
  assert.equal(ids.includes(publicPhotoId), true);
  assert.equal(ids.includes(privatePhotoId), false);
}

{
  const res = await app.inject({ method: 'GET', url: '/photos/page?since=1999-01-01T00:00:00.000Z&limit=50&offset=0', headers });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  const ids = (body.items || []).map((x) => String(x?.id || ''));
  assert.equal(ids.includes(publicPhotoId), true);
  assert.equal(ids.includes(privatePhotoId), true);
}

{
  const res = await app.inject({ method: 'GET', url: '/photos/page?since=1999-01-01T00:00:00.000Z&limit=50&offset=0', headers: adminHeaders });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  const ids = (body.items || []).map((x) => String(x?.id || ''));
  assert.equal(ids.includes(publicPhotoId), true);
  assert.equal(ids.includes(privatePhotoId), true);
}

{
  const res = await app.inject({ method: 'GET', url: `/photos/${publicPhotoId}` });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.id, publicPhotoId);
}

{
  const res = await app.inject({ method: 'GET', url: `/photos/${privatePhotoId}` });
  assert.equal(res.statusCode, 404);
  const body = res.json();
  assert.equal(body.code, 'PHOTO_NOT_FOUND');
}

{
  const res = await app.inject({ method: 'GET', url: `/photos/${privatePhotoId}`, headers });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.id, privatePhotoId);
}

{
  const res = await app.inject({ method: 'GET', url: `/media/photos/${publicPhotoId}` });
  assert.equal(res.statusCode, 200);
  assert.ok(String(res.headers['content-type'] || '').includes('image/jpeg'));
}

{
  const res = await app.inject({ method: 'GET', url: `/media/photos/${privatePhotoId}` });
  assert.equal(res.statusCode, 404);
}

{
  const res = await app.inject({ method: 'GET', url: `/media/photos/${privatePhotoId}`, headers });
  assert.equal(res.statusCode, 200);
  assert.ok(String(res.headers['content-type'] || '').includes('image/jpeg'));
}

{
  const res = await app.inject({
    method: 'GET',
    url: `/media/photos/${privatePhotoId}`,
    headers: { cookie: `phowson_token=${sessionToken}` },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(String(res.headers['content-type'] || '').includes('image/jpeg'));
}

{
  const res = await app.inject({
    method: 'POST',
    url: `/photos/${privatePhotoId}/like`,
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ guestId: `guest-${crypto.randomUUID()}` }),
  });
  assert.equal(res.statusCode, 404);
  const body = res.json();
  assert.equal(body.code, 'PHOTO_NOT_FOUND');
}

{
  const res = await app.inject({ method: 'GET', url: '/photos/page?since=2100-01-01T00:00:00.000Z&limit=10&offset=0' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(Array.isArray(body.items), true);
  assert.equal(typeof body.total, 'number');
  assert.equal(typeof body.limit, 'number');
  assert.equal(typeof body.offset, 'number');
  assert.equal(typeof body.hasMore, 'boolean');
  assert.equal(typeof body.nextOffset, 'number');
  assert.equal(typeof body.since, 'string');
  assert.equal(typeof body.nextSince, 'string');
}

{
  const res = await app.inject({ method: 'GET', url: '/photos/page?since=not-a-date' });
  assert.equal(res.statusCode, 400);
  const body = res.json();
  assert.equal(body.code, 'INVALID_SINCE');
}

await pool.query('delete from photos where id = any($1)', [[publicPhotoId, privatePhotoId]]);
await pool.query('delete from sessions where token_hash = $1', [sessionTokenHash]);
await pool.query('delete from users where id = $1', [userId]);

await app.close();
