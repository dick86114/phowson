import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { loadEnvIfNeeded } from '../lib/load_env.mjs'
import { createApp } from '../app.mjs'

loadEnvIfNeeded()

const adminHeaders = {
  'x-user-id': 'admin',
  'x-user-name': '管理员',
  'x-user-role': 'admin',
  'x-user-avatar': '',
  'x-user-permissions': 'admin_access,basic_access',
}
const adminJsonHeaders = {
  ...adminHeaders,
  'content-type': 'application/json',
}

const runUsersSuite = async () => {
  const app = createApp()
  await app.ready()
  const email = `u_${crypto.randomBytes(4).toString('hex')}@example.com`
  const email2 = `u_${crypto.randomBytes(4).toString('hex')}@example.com`
  const email3 = `u_${crypto.randomBytes(4).toString('hex')}@example.com`
  const password = 'Abcdefg1'
  let userId = ''
  let userId2 = ''
  try {
    {
      const res = await app.inject({
        method: 'POST',
        url: '/users',
        headers: adminJsonHeaders,
        payload: JSON.stringify({ name: 'Test User', email, role: 'family', password }),
      })
      assert.equal(res.statusCode, 201)
      const body = res.json()
      assert.equal(body.email, email)
      userId = body.id
      assert.ok(userId)
    }
    {
      const res = await app.inject({
        method: 'POST',
        url: '/users',
        headers: adminJsonHeaders,
        payload: JSON.stringify({ name: 'Test User', email: email3, role: 'family', password }),
      })
      assert.equal(res.statusCode, 400)
      const body = res.json()
      assert.equal(body.code, 'NAME_EXISTS')
    }
    {
      const res = await app.inject({
        method: 'POST',
        url: '/users',
        headers: adminJsonHeaders,
        payload: JSON.stringify({ name: 'Other Name', email: email2, role: 'family', password }),
      })
      assert.equal(res.statusCode, 201)
      const body = res.json()
      userId2 = body.id
      assert.ok(userId2)
    }
    {
      const res = await app.inject({
        method: 'PATCH',
        url: `/users/${encodeURIComponent(userId)}`,
        headers: adminJsonHeaders,
        payload: JSON.stringify({ name: 'Other Name' }),
      })
      assert.equal(res.statusCode, 400)
      const body = res.json()
      assert.equal(body.code, 'NAME_EXISTS')
    }
    {
      const res = await app.inject({
        method: 'GET',
        url: `/users/page?status=all&role=all&q=${encodeURIComponent(email)}&limit=10&offset=0`,
        headers: adminHeaders,
      })
      assert.equal(res.statusCode, 200)
      const body = res.json()
      assert.equal(typeof body.total, 'number')
      assert.equal(Array.isArray(body.items), true)
    }
    {
      const res = await app.inject({
        method: 'PATCH',
        url: `/users/${encodeURIComponent(userId)}/status`,
        headers: adminJsonHeaders,
        payload: JSON.stringify({ disabled: true }),
      })
      assert.equal(res.statusCode, 200)
      const body = res.json()
      assert.ok(body.disabledAt)
    }
    {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email, password }),
      })
      assert.equal(res.statusCode, 401)
    }
    {
      const res = await app.inject({
        method: 'PATCH',
        url: `/users/${encodeURIComponent(userId)}/status`,
        headers: adminJsonHeaders,
        payload: JSON.stringify({ disabled: false }),
      })
      assert.equal(res.statusCode, 200)
      const body = res.json()
      assert.equal(body.disabledAt, null)
    }
    {
      const res = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ email, password }),
      })
      assert.equal(res.statusCode, 200)
      const body = res.json()
      assert.ok(body.token)
    }
    {
      const res = await app.inject({
        method: 'DELETE',
        url: `/users/${encodeURIComponent(userId)}`,
        headers: adminHeaders,
      })
      assert.equal(res.statusCode, 200)
      const body = res.json()
      assert.equal(body.ok, true)
    }
    if (userId2) {
      const res = await app.inject({
        method: 'DELETE',
        url: `/users/${encodeURIComponent(userId2)}`,
        headers: adminHeaders,
      })
      assert.equal(res.statusCode, 200)
      const body = res.json()
      assert.equal(body.ok, true)
    }
  } finally {
    await app.close()
  }
}

const runImport = async (name, p) => {
  try {
    await import(p)
    return { name, ok: true }
  } catch (e) {
    return { name, ok: false, error: String(e?.message || e) }
  }
}

const main = async () => {
  const results = []

  try {
    await runUsersSuite()
    results.push({ name: '用户管理', ok: true })
  } catch (e) {
    results.push({ name: '用户管理', ok: false, error: String(e?.message || e) })
  }

  results.push(await runImport('验证码 base64', './auth_captcha_base64_routes_inject.test.mjs'))
  results.push(await runImport('注册邮箱验证码', './auth_register_email_code_routes_inject.test.mjs'))
  results.push(await runImport('评论筛选', './admin_comments_filters_routes_inject.test.mjs'))
  results.push(await runImport('评论批量操作', './admin_comments_batch_routes_inject.test.mjs'))
  results.push(await runImport('全站统计', './stats_summary_routes_inject.test.mjs'))
  results.push(await runImport('我的统计', './me_analytics_routes_inject.test.mjs'))
  results.push(await runImport('我的资料', './me_profile_routes_inject.test.mjs'))
  results.push(await runImport('我的时间线', './me_uploads_timeline_routes_inject.test.mjs'))
  results.push(await runImport('环境变量覆盖', './load_env_override.test.mjs'))
  results.push(await runImport('私有扩展加载', './private_extensions_loader_routes_inject.test.mjs'))
  results.push(await runImport('公开照片增量分页', './photos_page_since_routes_inject.test.mjs'))
  results.push(await runImport('筛选工具', './me_photos.test.mjs'))
  results.push(await runImport('异常路径', './negative_suite.mjs'))

  const failed = results.filter((r) => !r.ok)
  if (failed.length) {
    const lines = failed.map((f) => `${f.name}: ${f.error || '未知错误'}`).join('\n')
    throw new Error(lines)
  }
}

await main()
