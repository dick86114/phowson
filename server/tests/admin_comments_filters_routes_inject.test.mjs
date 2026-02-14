import assert from 'node:assert/strict';
import { createApp } from '../app.mjs';

const app = createApp();
await app.ready();

const headers = {
  'x-user-id': 'admin',
  'x-user-name': '管理员',
  'x-user-role': 'admin',
  'x-user-avatar': '',
};

{
  const res = await app.inject({
    method: 'GET',
    url: '/admin/comments?status=all&onlyGuest=false&userId=guest&from=2026-01-01&to=2026-01-31&limit=1&offset=0',
    headers,
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(typeof body.total, 'number');
  assert.equal(Array.isArray(body.items), true);
}

await app.close();

