import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../app.mjs';
import { pool } from '../db.mjs';

const app = createApp();
await app.ready();

// Create a test user without avatar
const userId = `test-avatar-${crypto.randomUUID()}`;
const userName = 'Test User';
await pool.query(
  'insert into users(id, name, role) values($1, $2, $3)',
  [userId, userName, 'family']
);

// Test accessing avatar
const res = await app.inject({
  method: 'GET',
  url: `/media/avatars/${userId}`,
});

// Should redirect to ui-avatars
assert.equal(res.statusCode, 302);
assert.ok(res.headers.location.includes('ui-avatars.com'));
assert.ok(res.headers.location.includes('Test%20User')); // Should be encoded

// Clean up
await pool.query('delete from users where id=$1', [userId]);

await app.close();
console.log('media_avatar_route.test.mjs: ok');
