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
  const res = await app.inject({ method: 'GET', url: '/me/analytics/hourly', headers });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(Array.isArray(body.hours), true);
  assert.equal(body.hours.length, 24);
  assert.equal(typeof body.total, 'number');
}

{
  const res = await app.inject({ method: 'GET', url: '/me/analytics/daily-goal', headers });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(typeof body.day, 'string');
  assert.equal(typeof body.uploads, 'number');
  assert.ok(body.goal === null || typeof body.goal === 'number');
}

{
  const res = await app.inject({
    method: 'POST',
    url: '/me/analytics/daily-goal',
    headers: { ...headers, 'content-type': 'application/json' },
    payload: JSON.stringify({ goal: 3 }),
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.goal, 3);
}

{
  const res = await app.inject({
    method: 'POST',
    url: '/me/analytics/daily-goal',
    headers: { ...headers, 'content-type': 'application/json' },
    payload: JSON.stringify({ goal: null }),
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.goal, null);
}

await app.close();

