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
  const res = await app.inject({ method: 'GET', url: '/admin/photos/filters', headers });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(Array.isArray(body.tags), true);
  assert.equal(Array.isArray(body.cameras), true);
}

{
  const res = await app.inject({ method: 'GET', url: '/admin/photos/page?limit=10&offset=0', headers });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(Array.isArray(body.items), true);
  assert.equal(typeof body.total, 'number');
}

await app.close();
console.log('admin_photos_page_routes_inject.test.mjs: ok');

