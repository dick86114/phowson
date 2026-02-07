import assert from 'node:assert/strict';
import { createApp } from '../app.mjs';

const app = createApp();
await app.ready();

const headers = {
  'x-user-id': 'test-user',
  'x-user-name': 'Test',
  'x-user-role': 'family',
  'x-user-avatar': '',
};

{
  const res = await app.inject({ method: 'GET', url: '/me/photos/filters', headers });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(Array.isArray(body.tags), true);
  assert.equal(Array.isArray(body.cameras), true);
}

{
  const res = await app.inject({ method: 'GET', url: '/me/photos/page?limit=1&offset=0', headers });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(Array.isArray(body.items), true);
  assert.equal(typeof body.total, 'number');
  assert.equal(typeof body.limit, 'number');
  assert.equal(typeof body.offset, 'number');
}

{
  const res = await app.inject({ method: 'GET', url: '/me/photos/page?onThisDay=1&monthDay=02-06&limit=1&offset=0', headers });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(Array.isArray(body.items), true);
}

await app.close();
console.log('me_photos_routes_inject.test.mjs: ok');
