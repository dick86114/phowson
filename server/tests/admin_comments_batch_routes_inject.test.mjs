import assert from 'node:assert/strict';
import { createApp } from '../app.mjs';

const app = createApp();
await app.ready();

const headers = {
  'x-user-id': 'admin',
  'x-user-name': '管理员',
  'x-user-role': 'admin',
  'x-user-avatar': '',
  'content-type': 'application/json',
};

{
  const res = await app.inject({
    method: 'POST',
    url: '/admin/comments/batch',
    headers,
    payload: JSON.stringify({ action: 'approve', ids: ['no-such-id'] }),
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.ok, true);
  assert.equal(body.action, 'approve');
  assert.equal(typeof body.matched, 'number');
}

{
  const res = await app.inject({
    method: 'POST',
    url: '/admin/comments/batch',
    headers,
    payload: JSON.stringify({ action: 'delete', ids: ['no-such-id'] }),
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.ok, true);
  assert.equal(body.action, 'delete');
}

await app.close();
console.log('admin_comments_batch_routes_inject.test.mjs: ok');

