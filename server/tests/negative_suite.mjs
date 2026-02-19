import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createApp } from '../app.mjs';
import { loadEnvIfNeeded } from '../lib/load_env.mjs';

loadEnvIfNeeded();

let baseUrl = String(process.env.API_BASE_URL || '').trim();
baseUrl = baseUrl.replace(/\/$/, '');

const baseHeadersAdminJson = {
  'x-user-id': 'admin',
  'x-user-name': '管理员',
  'x-user-role': 'admin',
  'x-user-avatar': '',
  'x-user-permissions': 'admin_access,basic_access',
  'content-type': 'application/json',
};
const baseHeadersAdminFetch = {
  'x-user-id': 'admin',
  'x-user-name': 'admin',
  'x-user-role': 'admin',
  'x-user-avatar': '',
  'x-user-permissions': 'admin_access,basic_access',
};

const json = (res) => res.json();

const testUsersDuplicateWeakSelfDisable = async (app) => {
  const email = `dup_${crypto.randomBytes(4).toString('hex')}@example.com`;
  const nameA = `UserA_${crypto.randomBytes(4).toString('hex')}`;
  const nameB = `UserB_${crypto.randomBytes(4).toString('hex')}`;
  let createdUserId = '';
  {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: baseHeadersAdminJson,
      payload: JSON.stringify({ name: nameA, email, role: 'family', password: 'Abcdefg1' }),
    });
    assert.equal(res.statusCode, 201);
    const body = await json(res);
    createdUserId = String(body?.id || '');
    assert.ok(createdUserId);
  }
  {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      headers: baseHeadersAdminJson,
      payload: JSON.stringify({ name: nameB, email, role: 'family', password: 'Abcdefg1' }),
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
  if (createdUserId) {
    const res = await app.inject({
      method: 'DELETE',
      url: `/users/${encodeURIComponent(createdUserId)}`,
      headers: baseHeadersAdminFetch,
    });
    assert.equal(res.statusCode, 200);
    const body = await json(res);
    assert.equal(body.ok, true);
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
    const res = await fetch(`${baseUrl}/photos`, { method: 'POST', headers: baseHeadersAdminFetch, body: fd });
    assert.equal(res.status, 201);
    return res.json();
  })();
  const id = created.id;
  {
    const captchaRes = await fetch(`${baseUrl}/auth/captcha`);
    assert.equal(captchaRes.status, 200);
    const captchaBody = await captchaRes.json();
    // 用错误验证码
    const guestRes = await fetch(`${baseUrl}/photos/${id}/comment`, {
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
    const adminRes = await fetch(`${baseUrl}/photos/${id}/comment`, {
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
    const res = await fetch(`${baseUrl}/stats/summary?days=${days}`);
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
  const tooLargeRes = await fetch(`${baseUrl}/photos`, {
    method: 'POST',
    headers: baseHeadersAdminFetch,
    body: tooLargeFd,
  });
  assert.equal(tooLargeRes.status, 413);
  const tooLargeBody = await tooLargeRes.json();
  assert.equal(tooLargeBody.code, 'PHOTO_TOO_LARGE');
};

const testAiFillEditMode = async () => {
  const onePixelJpegBase64 =
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARASExgYGCgaGDEkJSQkJGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGP/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==';
  const imageBytes = Buffer.from(onePixelJpegBase64, 'base64');
  const file = new File([imageBytes], 'ai-edit.jpg', { type: 'image/jpeg' });
  const fd = new FormData();
  fd.append('photo', file);
  fd.append('title', 'ai edit');
  fd.append('description', 'ai edit');
  fd.append('category', 'uncategorized');
  fd.append('tags', 'x');
  fd.append('exif', JSON.stringify({}));

  const created = await (async () => {
    const res = await fetch(`${baseUrl}/photos`, { method: 'POST', headers: baseHeadersAdminFetch, body: fd });
    assert.equal(res.status, 201);
    return res.json();
  })();
  const id = created.id;

  {
    const res = await fetch(`${baseUrl}/photos/${id}/ai-fill`, { method: 'POST' });
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.code, 'UNAUTHORIZED');
  }

  {
    const res = await fetch(`${baseUrl}/photos/${id}/ai-fill`, { method: 'POST', headers: baseHeadersAdminFetch });
    assert.ok([200, 400, 501, 502].includes(res.status));
    const body = await res.json();
    if (res.status === 501) {
      assert.equal(body.code, 'AI_NOT_CONFIGURED');
    } else if (res.status === 400) {
      assert.equal(body.code, 'AI_MODEL_UNSUPPORTED');
      assert.equal(typeof body.message, 'string');
      assert.ok(body.message.length > 0);
    } else if (res.status === 502) {
      assert.equal(body.code, 'AI_UPSTREAM_ERROR');
      assert.equal(typeof body.message, 'string');
      assert.ok(body.message.length > 0);
    } else {
      assert.ok(body && typeof body === 'object');
    }
  }

  {
    const delRes = await fetch(`${baseUrl}/photos/${id}`, { method: 'DELETE', headers: baseHeadersAdminFetch });
    assert.equal(delRes.status, 200);
    const delBody = await delRes.json();
    assert.equal(delBody.ok, true);
  }
};

const testEditSaveLocationAndDate = async () => {
  const userId = `edit-family-${crypto.randomUUID()}`;
  const familyHeaders = {
    'x-user-id': userId,
    'x-user-name': 'Family',
    'x-user-role': 'family',
    'x-user-avatar': '',
    'x-user-permissions': 'basic_access',
  };
  const otherHeaders = {
    'x-user-id': `other-family-${crypto.randomUUID()}`,
    'x-user-name': 'Other',
    'x-user-role': 'family',
    'x-user-avatar': '',
    'x-user-permissions': 'basic_access',
  };

  const onePixelJpegBase64 =
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARASExgYGCgaGDEkJSQkJGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGP/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==';
  const imageBytes = Buffer.from(onePixelJpegBase64, 'base64');

  const created = await (async () => {
    const file = new File([imageBytes], 'edit-save.jpg', { type: 'image/jpeg' });
    const fd = new FormData();
    fd.append('photo', file);
    fd.append('title', 'before');
    fd.append('description', 'before');
    fd.append('category', 'uncategorized');
    fd.append('tags', 'x');
    fd.append('isPublic', 'true');
    fd.append('exif', JSON.stringify({}));
    const res = await fetch(`${baseUrl}/photos`, { method: 'POST', headers: familyHeaders, body: fd });
    assert.equal(res.status, 201);
    return res.json();
  })();
  const id = created.id;

  {
    const fd = new FormData();
    fd.append('title', 'after');
    fd.append('exif', JSON.stringify({ location: '北京', DateTimeOriginal: '2020-02-03T00:00:00.000Z' }));
    const res = await fetch(`${baseUrl}/photos/${id}`, { method: 'PATCH', headers: familyHeaders, body: fd });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.title, 'after');
  }

  {
    const res = await fetch(`${baseUrl}/photos/${id}`, { method: 'GET', headers: familyHeaders });
    assert.equal(res.status, 200);
    const body = await res.json();
    const exif = JSON.parse(String(body.exif || '{}'));
    assert.equal(exif.location, '北京');
    assert.equal(exif.date, '2020-02-03');
  }

  {
    const fd = new FormData();
    fd.append('title', 'hijack');
    const res = await fetch(`${baseUrl}/photos/${id}`, { method: 'PATCH', headers: otherHeaders, body: fd });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'FORBIDDEN');
  }

  {
    const delRes = await fetch(`${baseUrl}/photos/${id}`, { method: 'DELETE', headers: baseHeadersAdminFetch });
    assert.equal(delRes.status, 200);
    const delBody = await delRes.json();
    assert.equal(delBody.ok, true);
  }
};

const main = async () => {
  const app = createApp();
  await app.ready();
  if (!baseUrl) {
    baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    baseUrl = baseUrl.replace(/\/$/, '');
  }
  await testUsersDuplicateWeakSelfDisable(app);
  await testCommentsCaptchaSpam(app);
  await testStatsDays();
  await testUploadTooLarge();
  await testAiFillEditMode();
  await testEditSaveLocationAndDate();
  await app.close();
};

await main();
