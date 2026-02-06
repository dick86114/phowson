import assert from 'node:assert/strict';
import { loadEnvIfNeeded } from '../lib/load_env.mjs';

loadEnvIfNeeded();

if (String(process.env.SMOKE_USE_S3 || '').toLowerCase() !== 'true') {
  delete process.env.S3_ACCESS_KEY_ID;
  delete process.env.S3_SECRET_ACCESS_KEY;
  delete process.env.S3_BUCKET;
  delete process.env.S3_PUBLIC_BASE_URL;
  delete process.env.S3_ENDPOINT;
  delete process.env.S3_REGION;
  delete process.env.S3_FORCE_PATH_STYLE;
}

const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';

const headers = {
  'x-user-id': 'admin',
  'x-user-name': 'admin',
  'x-user-role': 'admin',
};

const json = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const main = async () => {
  {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
  }

  {
    const categoriesRes = await fetch(`${baseUrl}/categories`);
    assert.equal(categoriesRes.status, 200);
    const categories = await categoriesRes.json();
    assert.ok(Array.isArray(categories));
  }

  {
    const catValue = `smoke-cat-${Date.now()}`;
    const unauthCreateRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value: catValue, label: 'Smoke', sortOrder: 999 }),
    });
    assert.equal(unauthCreateRes.status, 401);
  }

  {
    const catValue = `smoke-cat-${Date.now()}`;
    const createRes = await fetch(`${baseUrl}/categories`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ value: catValue, label: 'Smoke', sortOrder: 999 }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    assert.equal(created.value, catValue);

    const patchRes = await fetch(`${baseUrl}/categories/${catValue}`, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'Smoke2', sortOrder: 998 }),
    });
    assert.equal(patchRes.status, 200);

    const delRes = await fetch(`${baseUrl}/categories/${catValue}`, { method: 'DELETE', headers });
    assert.equal(delRes.status, 200);
  }

  {
    const usersRes = await fetch(`${baseUrl}/users`, { headers });
    assert.equal(usersRes.status, 200);
    const users = await usersRes.json();
    assert.ok(Array.isArray(users));
  }

  const listRes = await fetch(`${baseUrl}/photos`);
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.ok(Array.isArray(list));

  if (String(process.env.SMOKE_TEST_TOO_LARGE_UPLOAD || '').toLowerCase() === 'true') {
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
    tooLargeFd.append('exif', JSON.stringify({ camera: 'smoke' }));

    const tooLargeRes = await fetch(`${baseUrl}/photos`, {
      method: 'POST',
      headers,
      body: tooLargeFd,
    });
    assert.equal(tooLargeRes.status, 413);
    const tooLargeBody = await json(tooLargeRes);
    assert.equal(tooLargeBody.code, 'PHOTO_TOO_LARGE');
  }

  const fd = new FormData();
  const onePixelJpegBase64 =
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARASExgYGCgaGDEkJSQkJGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGP/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==';
  const imageBytes = Buffer.from(onePixelJpegBase64, 'base64');
  {
    const importId = `smoke-import-${Date.now()}`;
    const importRes = await fetch(`${baseUrl}/admin/migrate/localstorage`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({
        photos: [
          {
            id: importId,
            title: 'smoke import',
            description: 'smoke import',
            category: 'uncategorized',
            tags: ['a', 'b'],
            exif: JSON.stringify({ camera: 'smoke-import' }),
            url: `data:image/jpeg;base64,${onePixelJpegBase64}`,
            createdAt: new Date().toISOString(),
            viewsCount: 0,
            likesCount: 0,
          },
        ],
      }),
    });
    assert.equal(importRes.status, 200);
    const importBody = await importRes.json();
    assert.equal(importBody.ok, true);

    const importDetailRes = await fetch(`${baseUrl}/photos/${importId}`);
    assert.equal(importDetailRes.status, 200);
    const importDetail = await importDetailRes.json();
    assert.equal(importDetail.id, importId);
    assert.equal(importDetail.imageWidth, 1);
    assert.equal(importDetail.imageHeight, 1);
    assert.equal(importDetail.imageSizeBytes, imageBytes.length);

    const importDelRes = await fetch(`${baseUrl}/photos/${importId}`, { method: 'DELETE', headers });
    assert.equal(importDelRes.status, 200);
    const importDelBody = await importDelRes.json();
    assert.equal(importDelBody.ok, true);
  }
  const file = new File([imageBytes], 'test.jpg', { type: 'image/jpeg' });
  fd.append('photo', file);
  fd.append('title', 'smoke photo');
  fd.append('description', 'smoke');
  fd.append('category', 'uncategorized');
  fd.append('tags', 'a,b');
  fd.append('exif', JSON.stringify({ camera: 'smoke-cam', iso: '100' }));

  const createRes = await fetch(`${baseUrl}/photos`, {
    method: 'POST',
    headers,
    body: fd,
  });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  assert.ok(created.id);
  assert.equal(created.imageWidth, 1);
  assert.equal(created.imageHeight, 1);
  assert.equal(created.imageSizeBytes, imageBytes.length);

  const id = created.id;

  const detailRes = await fetch(`${baseUrl}/photos/${id}`);
  assert.equal(detailRes.status, 200);
  const detail = await detailRes.json();
  assert.equal(detail.id, id);
  assert.equal(detail.imageWidth, 1);
  assert.equal(detail.imageHeight, 1);
  assert.equal(detail.imageSizeBytes, imageBytes.length);

  const commentRes = await fetch(`${baseUrl}/photos/${id}/comment`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ content: 'smoke comment' }),
  });
  assert.equal(commentRes.status, 200);
  const afterComment = await commentRes.json();
  assert.ok(Array.isArray(afterComment.comments));
  assert.ok(afterComment.comments.length >= 1);

  {
    const ts = Date.now();
    const captchaRes = await fetch(`${baseUrl}/auth/captcha`);
    assert.equal(captchaRes.status, 200);
    const captchaBody = await captchaRes.json();
    assert.ok(typeof captchaBody?.token === 'string');
    const decoded = Buffer.from(String(captchaBody.token), 'base64').toString('utf8');
    const [answer] = decoded.split(':');
    assert.ok(answer);

    const guestContent = `smoke guest comment ${ts}`;
    const guestId = `smoke-guest-${ts}`;

    const guestCommentRes = await fetch(`${baseUrl}/photos/${id}/comment`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: guestContent,
        guestId,
        nickname: 'SmokeGuest',
        email: `smoke-${ts}@example.com`,
        captcha: answer,
        captchaToken: captchaBody.token,
      }),
    });
    assert.equal(guestCommentRes.status, 200);
    const guestAfter = await guestCommentRes.json();
    assert.ok(Array.isArray(guestAfter.comments));
    assert.equal(guestAfter.comments.some((c) => c?.content === guestContent), false);

    const pendingListRes = await fetch(
      `${baseUrl}/admin/comments?status=pending&onlyGuest=true&q=${encodeURIComponent(guestContent)}&limit=10&offset=0`,
      { headers },
    );
    assert.equal(pendingListRes.status, 200);
    const pendingList = await pendingListRes.json();
    assert.ok(Array.isArray(pendingList.items));
    const pending = pendingList.items.find((x) => x?.content === guestContent);
    assert.ok(pending?.id);

    const approveRes = await fetch(`${baseUrl}/admin/comments/${pending.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });
    assert.equal(approveRes.status, 200);

    const afterApproveDetailRes = await fetch(`${baseUrl}/photos/${id}`);
    assert.equal(afterApproveDetailRes.status, 200);
    const afterApproveDetail = await afterApproveDetailRes.json();
    assert.ok(Array.isArray(afterApproveDetail.comments));
    assert.equal(afterApproveDetail.comments.some((c) => c?.content === guestContent), true);
  }

  const like1Res = await fetch(`${baseUrl}/photos/${id}/like`, { method: 'POST', headers });
  assert.equal(like1Res.status, 200);
  const liked1 = await like1Res.json();
  assert.ok(Array.isArray(liked1.likes));
  assert.equal(liked1.likes.length, 1);

  const like2Res = await fetch(`${baseUrl}/photos/${id}/like`, { method: 'POST', headers });
  assert.equal(like2Res.status, 200);
  const liked2 = await like2Res.json();
  assert.ok(Array.isArray(liked2.likes));
  assert.equal(liked2.likes.length, 0);

  {
    const forbiddenRes = await fetch(`${baseUrl}/photos/${id}`, { method: 'DELETE' });
    assert.equal(forbiddenRes.status, 401);
    const forbiddenBody = await forbiddenRes.json();
    assert.equal(forbiddenBody.code, 'UNAUTHORIZED');
  }

  const statsRes = await fetch(`${baseUrl}/stats/summary`);
  assert.equal(statsRes.status, 200);
  const stats = await statsRes.json();
  assert.ok(typeof stats?.summary?.total_likes === 'number');

  const delRes = await fetch(`${baseUrl}/photos/${id}`, { method: 'DELETE', headers });
  assert.equal(delRes.status, 200);
  const delBody = await delRes.json();
  assert.equal(delBody.ok, true);

  const missingRes = await fetch(`${baseUrl}/photos/${id}`);
  assert.equal(missingRes.status, 404);
  const missing = await json(missingRes);
  assert.equal(missing.code, 'PHOTO_NOT_FOUND');
};

await main();
