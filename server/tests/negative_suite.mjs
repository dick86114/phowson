import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../app.mjs';
import { loadEnvIfNeeded } from '../lib/load_env.mjs';

loadEnvIfNeeded();

const baseHeadersAdminJson = {
  'x-user-id': 'admin',
  'x-user-name': '管理员',
  'x-user-role': 'admin',
  'x-user-avatar': '',
  'content-type': 'application/json',
};
const baseHeadersAdminFetch = {
  'x-user-id': 'admin',
  'x-user-name': 'admin',
  'x-user-role': 'admin',
  'x-user-avatar': '',
};

const json = (res) => res.json();

const testUsersDuplicateWeakSelfDisable = async (app) => {
  const email = `dup_${crypto.randomBytes(4).toString('hex')}@example.com`;
  {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: baseHeadersAdminJson,
      payload: JSON.stringify({ name: 'UserA', email, role: 'family', password: 'Abcdefg1' }),
    });
    assert.equal(res.statusCode, 201);
  }
  {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: baseHeadersAdminJson,
      payload: JSON.stringify({ name: 'UserB', email, role: 'family', password: 'Abcdefg1' }),
    });
    assert.equal(res.statusCode, 500); // unique index violation bubbles up
  }
  {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: baseHeadersAdminJson,
      payload: JSON.stringify({ name: 'Weak', email: `weak_${crypto.randomBytes(4).toString('hex')}@example.com`, role: 'family', password: '123' }),
    });
    assert.equal(res.statusCode, 400);
    const body = await json(res);
    assert.ok(['BAD_REQUEST', 'FST_ERR_VALIDATION', 'VALIDATION_ERROR'].includes(body.code));
  }
  {
    const res = await app.inject({
      method: 'PATCH',
      url: `/users/${encodeURIComponent('admin')}/status`,
      headers: baseHeadersAdminJson,
      payload: JSON.stringify({ disabled: true }),
    });
    assert.equal(res.statusCode, 400);
    const body = await json(res);
    assert.equal(body.code, 'CANNOT_DISABLE_SELF');
  }
};

const testCommentsCaptchaSpam = async (app) => {
  const onePixelJpegBase64 =
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARASExgYGCgaGDEkJSQkJGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGP/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==';
  const imageBytes = Buffer.from(onePixelJpegBase64, 'base64');
  const file = new File([imageBytes], 'test.jpg', { type: 'image/jpeg' });
  const fd = new FormData();
  fd.append('photo', file);
  fd.append('title', 'neg photo');
  fd.append('description', 'neg');
  fd.append('category', 'uncategorized');
  fd.append('tags', 'x');
  fd.append('exif', JSON.stringify({}));
  const created = await (async () => {
    const res = await fetch('http://localhost:3001/photos', { method: 'POST', headers: baseHeadersAdminFetch, body: fd });
    assert.equal(res.status, 201);
    return res.json();
  })();
  const id = created.id;
  {
    const captchaRes = await fetch('http://localhost:3001/auth/captcha');
    assert.equal(captchaRes.status, 200);
    const captchaBody = await captchaRes.json();
    // 用错误验证码
    const guestRes = await fetch(`http://localhost:3001/photos/${id}/comment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: 'hello world',
        guestId: 'neg-guest',
        nickname: 'Neg',
        email: 'neg@example.com',
        captcha: 'WRONG',
        captchaToken: captchaBody.token,
      }),
    });
    assert.equal(guestRes.status, 400);
    const body = await guestRes.json();
    assert.equal(body.code, 'CAPTCHA_INVALID');
  }
  {
    const adminRes = await fetch(`http://localhost:3001/photos/${id}/comment`, {
      method: 'POST',
      headers: { ...baseHeadersAdminFetch, 'content-type': 'application/json' },
      body: JSON.stringify({ content: '请关注我 https://spam.example.com' }),
    });
    assert.equal(adminRes.status, 200);
    const after = await adminRes.json();
    assert.ok(Array.isArray(after.comments));
    assert.equal(after.comments.some((c) => String(c?.content || '').includes('spam.example.com')), false);
  }
};

const testStatsDays = async () => {
  const check = async (days) => {
    const res = await fetch(`http://localhost:3001/stats/summary?days=${days}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(typeof body?.summary?.total_photos === 'number');
    assert.ok(Array.isArray(body?.categoryDistribution));
    assert.ok(Array.isArray(body?.uploadTrend));
    assert.ok(Array.isArray(body?.heatmap));
  };
  await check(7);
  await check(30);
  await check(365);
};

const testUploadTooLarge = async () => {
  const maxBytesEnv = Number(process.env.UPLOAD_MAX_BYTES);
  const maxBytes = Number.isFinite(maxBytesEnv) && maxBytesEnv > 0 ? maxBytesEnv : 60 * 1024 * 1024;
  const tooLargeBytes = maxBytes + 1;
  const tooLargeFd = new FormData();
  const tooLargeFile = new File([new Uint8Array(tooLargeBytes)], 'too-large.jpg', { type: 'image/jpeg' });
  tooLargeFd.append('photo', tooLargeFile);
  tooLargeFd.append('title', 'too large');
  tooLargeFd.append('description', 'too large');
  tooLargeFd.append('category', 'uncategorized');
  tooLargeFd.append('tags', 'a');
  tooLargeFd.append('exif', JSON.stringify({ camera: 'neg' }));
  const tooLargeRes = await fetch('http://localhost:3001/photos', {
    method: 'POST',
    headers: baseHeadersAdminFetch,
    body: tooLargeFd,
  });
  assert.equal(tooLargeRes.status, 413);
  const tooLargeBody = await tooLargeRes.json();
  assert.equal(tooLargeBody.code, 'PHOTO_TOO_LARGE');
};

const main = async () => {
  const app = createApp();
  await app.ready();
  await testUsersDuplicateWeakSelfDisable(app);
  await testCommentsCaptchaSpam(app);
  await testStatsDays();
  await testUploadTooLarge();
  await app.close();
};

await main();
