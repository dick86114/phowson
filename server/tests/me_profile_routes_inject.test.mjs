import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../app.mjs';

const app = createApp();
await app.ready();

const userId = `test-profile-${crypto.randomUUID()}`;
const headers = {
  'x-user-id': userId,
  'x-user-name': 'Test',
  'x-user-role': 'family',
  'x-user-avatar': '',
};

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

await app.close();

