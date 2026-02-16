import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../app.mjs';
import { pool } from '../db.mjs';

const app = createApp();
await app.ready();

const userId = `test-profile-${crypto.randomUUID()}`;
const headers = {
  'x-user-id': userId,
  'x-user-name': 'Test',
  'x-user-role': 'family',
  'x-user-avatar': '',
};

const dupUserId = `test-profile-dup-${crypto.randomUUID()}`;
try {
  {
    const res = await app.inject({ method: 'GET', url: '/me/profile', headers });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.id, userId);
    assert.equal(typeof body.name, 'string');
    assert.equal(typeof body.role, 'string');
    assert.equal(typeof body.avatar, 'string');
  }

  {
    const res = await app.inject({
      method: 'PATCH',
      url: '/me/profile',
      headers: { ...headers, 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'New Name' }),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.name, 'New Name');
  }

  await pool.query('insert into users(id, name, role) values ($1, $2, $3) on conflict (id) do nothing', [dupUserId, 'Dup Name', 'family']);

  {
    const res = await app.inject({
      method: 'PATCH',
      url: '/me/profile',
      headers: { ...headers, 'content-type': 'application/json' },
      payload: JSON.stringify({ name: 'Dup Name' }),
    });
    assert.equal(res.statusCode, 400);
    const body = res.json();
    assert.equal(body.code, 'NAME_EXISTS');
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/me/profile/password',
      headers: { ...headers, 'content-type': 'application/json' },
      payload: JSON.stringify({ newPassword: 'Abcdefg1' }),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.ok, true);
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/me/profile/password',
      headers: { ...headers, 'content-type': 'application/json' },
      payload: JSON.stringify({ currentPassword: 'Abcdefg1', newPassword: 'Abcdefg2' }),
    });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.ok, true);
  }
} finally {
  await pool.query('delete from users where id = any($1)', [[userId, dupUserId]]);
  await app.close();
}
