import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { loadEnvIfNeeded } from '../lib/load_env.mjs'
import { createApp } from '../app.mjs'

loadEnvIfNeeded()

const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001'
const adminHeaders = {
  'x-user-id': 'admin',
  'x-user-name': '管理员',
  'x-user-role': 'admin',
  'x-user-avatar': '',
}
const adminJsonHeaders = {
  ...adminHeaders,
  'content-type': 'application/json',
}

const nowIso = new Date().toISOString().replace(/[:.]/g, '-')

const waitBackend = async () => {
  const deadline = Date.now() + 20000
  let lastErr = null
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`)
      if (res.ok) {
        const body = await res.json()
        if (body?.ok) return true
      }
    } catch (e) {
      lastErr = e
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  if (lastErr) throw lastErr
  throw new Error('后端健康检查超时')
}

const runUsersSuite = async () => {
  const start = Date.now()
  const app = createApp()
  await app.ready()
  const email = `u_${crypto.randomBytes(4).toString('hex')}@example.com`
  const password = 'Abcdefg1'
  let userId = ''
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
    await app.close()
    return { name: '用户管理', ok: true, durationMs: Date.now() - start }
  } catch (e) {
    await app.close()
    return { name: '用户管理', ok: false, durationMs: Date.now() - start, error: String(e?.message || e) }
  }
}

const runSmokeSuite = async () => {
  const start = Date.now()
  try {
    await waitBackend()
    await import('./smoke.mjs')
    return { name: '系统端到端', ok: true, durationMs: Date.now() - start }
  } catch (e) {
    return { name: '系统端到端', ok: false, durationMs: Date.now() - start, error: String(e?.message || e) }
  }
}

const runInjectSuite = async (name, path) => {
  const start = Date.now()
  try {
    await import(path)
    return { name, ok: true, durationMs: Date.now() - start }
  } catch (e) {
    return { name, ok: false, durationMs: Date.now() - start, error: String(e?.message || e) }
  }
}

const makeReport = (results) => {
  const total = results.length
  const passed = results.filter((r) => r.ok).length
  const failed = total - passed
  const lines = []
  lines.push(`# Phowson 全量测试报告`)
  lines.push(`- 时间: ${new Date().toISOString()}`)
  lines.push(`- 总用例: ${total}`)
  lines.push(`- 通过: ${passed}`)
  lines.push(`- 失败: ${failed}`)
  lines.push('')
  for (const r of results) {
    lines.push(`## 用例: ${r.name}`)
    lines.push(`- 结果: ${r.ok ? '通过' : '失败'}`)
    lines.push(`- 耗时: ${r.durationMs}ms`)
    if (!r.ok && r.error) lines.push(`- 错误: ${r.error}`)
    lines.push('')
  }
  return lines.join('\n')
}

const main = async () => {
  const results = []
  results.push(await runUsersSuite())
  results.push(await runInjectSuite('评论筛选', './admin_comments_filters_routes_inject.test.mjs'))
  results.push(await runInjectSuite('评论批量操作', './admin_comments_batch_routes_inject.test.mjs'))
  results.push(await runInjectSuite('我的统计', './me_analytics_routes_inject.test.mjs'))
  results.push(await runInjectSuite('我的资料', './me_profile_routes_inject.test.mjs'))
  results.push(await runInjectSuite('我的时间线', './me_uploads_timeline_routes_inject.test.mjs'))
  results.push(await runInjectSuite('筛选工具', './me_photos.test.mjs'))
  results.push(await runInjectSuite('异常路径', './negative_suite.mjs'))
  results.push(await runSmokeSuite())
  const report = makeReport(results)
  await fs.mkdir('reports', { recursive: true })
  const file = `reports/test-report-${nowIso}.md`
  await fs.writeFile(file, report, 'utf8')
  console.log(file)
}

await main()
