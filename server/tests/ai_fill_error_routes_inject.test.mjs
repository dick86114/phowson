import assert from 'node:assert/strict'
import { createApp } from '../app.mjs'
import { pool } from '../db.mjs'

const adminHeaders = {
  'x-user-id': 'admin',
  'x-user-name': '管理员',
  'x-user-role': 'admin',
  'x-user-avatar': '',
  'x-user-permissions': 'admin_access,basic_access',
  'content-type': 'application/json',
}

const onePixelJpegBase64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARASExgYGCgaGDEkJSQkJGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGRkZGP/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q=='

const upsertSettings = async (data) => {
  await pool.query(
    `insert into site_settings(id, data)
     values ('global', $1::jsonb)
     on conflict (id) do update set data = excluded.data`,
    [data],
  )
}

const getSettings = async () => {
  const r = await pool.query(`select data from site_settings where id = 'global'`)
  return r.rowCount ? r.rows[0]?.data ?? null : null
}

const deleteSettings = async () => {
  await pool.query(`delete from site_settings where id = 'global'`)
}

const app = createApp()
await app.ready()

let prev = null
try {
  prev = await getSettings()
  await upsertSettings({
    ai: {
      provider: 'openai_compatible',
      openai_compatible: {
        apiKey: 'test-key',
        baseUrl: 'http://127.0.0.1:1',
        model: 'glm-5',
      },
    },
  })

  const res = await app.inject({
    method: 'POST',
    url: '/ai/fill',
    headers: adminHeaders,
    payload: JSON.stringify({
      imageBase64: onePixelJpegBase64,
      mimeType: 'image/jpeg',
      locationHint: '',
      filename: 'test.jpg',
    }),
  })

  assert.equal(res.statusCode, 502)
  const body = res.json()
  assert.equal(body.code, 'AI_UPSTREAM_ERROR')
  assert.equal(typeof body.message, 'string')
  assert.ok(body.message.length > 0)
  assert.equal(typeof body.requestId, 'string')
  assert.ok(body.requestId.length > 0)
} finally {
  if (prev) await upsertSettings(prev)
  else await deleteSettings()
  await app.close()
}

