import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../app.mjs';
import { pool } from '../db.mjs';

const app = createApp();
await app.ready();

const userId = `test-stats-${crypto.randomUUID()}`;
await pool.query('insert into users(id, name, role) values ($1,$2,$3) on conflict (id) do nothing', [userId, 'Stats Test', 'family']);

const catNow = `stats-now-${crypto.randomBytes(6).toString('hex')}`;
const catOld = `stats-old-${crypto.randomBytes(6).toString('hex')}`;

const photoNowId = `stats-photo-now-${crypto.randomUUID()}`;
const photoOldId = `stats-photo-old-${crypto.randomUUID()}`;

await pool.query(
  `insert into photos(id, owner_user_id, title, description, category, created_at, updated_at)
   values ($1,$2,$3,$4,$5, now(), now())`,
  [photoNowId, userId, 'stats now', '', catNow],
);

await pool.query(
  `insert into photos(id, owner_user_id, title, description, category, created_at, updated_at)
   values ($1,$2,$3,$4,$5, now() - interval '20 days', now() - interval '20 days')`,
  [photoOldId, userId, 'stats old', '', catOld],
);

{
  const res = await app.inject({ method: 'GET', url: '/stats/summary?days=7' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(Array.isArray(body.categoryDistribution), true);
  const cats = body.categoryDistribution.map((x) => String(x?.category || ''));
  assert.equal(cats.includes(catNow), true);
  assert.equal(cats.includes(catOld), false);
}

{
  const res = await app.inject({ method: 'GET', url: '/stats/summary?days=30' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(Array.isArray(body.categoryDistribution), true);
  const cats = body.categoryDistribution.map((x) => String(x?.category || ''));
  assert.equal(cats.includes(catNow), true);
  assert.equal(cats.includes(catOld), true);
}

await pool.query('delete from photos where id = any($1)', [[photoNowId, photoOldId]]);
await pool.query('delete from users where id = $1', [userId]);

await app.close();
