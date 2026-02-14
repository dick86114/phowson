import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../app.mjs';

const app = createApp();
await app.ready();

const adminHeaders = {
  'x-user-id': 'admin',
  'x-user-name': '管理员',
  'x-user-role': 'admin',
  'x-user-avatar': '',
  'content-type': 'application/json',
};

const email = `u_${crypto.randomBytes(4).toString('hex')}@example.com`;
const password = 'Abcdefg1';

let userId = '';

{
  const res = await app.inject({
    method: 'POST',
    url: '/users',
    headers: adminHeaders,
    payload: JSON.stringify({ name: 'Test User', email, role: 'family', password }),
  });
  assert.equal(res.statusCode, 201);
  const body = res.json();
  assert.equal(body.email, email);
  userId = body.id;
  assert.ok(userId);
}

{
  const res = await app.inject({
    method: 'GET',
    url: `/users/page?status=all&role=all&q=${encodeURIComponent(email)}&limit=10&offset=0`,
    headers: adminHeaders,
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(typeof body.total, 'number');
  assert.equal(Array.isArray(body.items), true);
}

{
  const res = await app.inject({
    method: 'PATCH',
    url: `/users/${encodeURIComponent(userId)}/status`,
    headers: adminHeaders,
    payload: JSON.stringify({ disabled: true }),
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(body.disabledAt);
}

{
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email, password }),
  });
  assert.equal(res.statusCode, 401);
}

{
  const res = await app.inject({
    method: 'GET',
    url: `/users/page?status=disabled&role=all&q=${encodeURIComponent(email)}&limit=10&offset=0`,
    headers: adminHeaders,
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(Array.isArray(body.items), true);
}

{
  const res = await app.inject({
    method: 'PATCH',
    url: `/users/${encodeURIComponent(userId)}/status`,
    headers: adminHeaders,
    payload: JSON.stringify({ disabled: false }),
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.disabledAt, null);
}

{
  const res = await app.inject({
    method: 'POST',
    url: '/auth/login',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email, password }),
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(body.token);
}

await app.close();

