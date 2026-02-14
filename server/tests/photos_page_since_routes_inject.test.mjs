import assert from 'node:assert/strict';
import { createApp } from '../app.mjs';

const app = createApp();
await app.ready();

{
  const res = await app.inject({ method: 'GET', url: '/photos/page?since=2100-01-01T00:00:00.000Z&limit=10&offset=0' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(Array.isArray(body.items), true);
  assert.equal(typeof body.total, 'number');
  assert.equal(typeof body.limit, 'number');
  assert.equal(typeof body.offset, 'number');
  assert.equal(typeof body.hasMore, 'boolean');
  assert.equal(typeof body.nextOffset, 'number');
  assert.equal(typeof body.since, 'string');
  assert.equal(typeof body.nextSince, 'string');
}

{
  const res = await app.inject({ method: 'GET', url: '/photos/page?since=not-a-date' });
  assert.equal(res.statusCode, 400);
  const body = res.json();
  assert.equal(body.code, 'INVALID_SINCE');
}

await app.close();
