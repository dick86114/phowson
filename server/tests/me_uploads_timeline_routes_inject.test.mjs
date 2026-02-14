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
  const res = await app.inject({ method: 'GET', url: '/me/uploads/timeline', headers });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(typeof body.from, 'string');
  assert.equal(typeof body.to, 'string');
  assert.equal(typeof body.keyword, 'string');
  assert.equal(typeof body.totalDays, 'number');
  assert.equal(Array.isArray(body.items), true);
}

{
  const res = await app.inject({ method: 'GET', url: '/me/uploads/timeline?from=2026-01-01&to=2026-01-31&limitDays=5&offsetDays=0&keyword=abc', headers });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.limitDays, 5);
  assert.equal(body.offsetDays, 0);
  assert.equal(body.keyword, 'abc');
}

await app.close();

