import assert from 'node:assert/strict';
import { createApp } from '../app.mjs';

const app = createApp();
await app.ready();

{
  const res = await app.inject({ method: 'GET', url: '/auth/captcha?format=base64' });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(typeof body.token, 'string');
  assert.equal(typeof body.pngBase64, 'string');
  assert.equal(body.mimeType, 'image/png');
  assert.ok(body.pngBase64.length > 100);
}

{
  const res = await app.inject({ method: 'GET', url: '/auth/captcha?format=unknown' });
  assert.equal(res.statusCode, 400);
  const body = res.json();
  assert.equal(body.code, 'INVALID_CAPTCHA_FORMAT');
}

await app.close();
