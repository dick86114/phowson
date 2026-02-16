import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { createApp } from '../app.mjs'
import { pool } from '../db.mjs'

process.env.EMAIL_PROVIDER = 'log'
process.env.EMAIL_CODE_DEBUG = '1'

const decodeCaptchaAnswer = (token) => {
  const decoded = Buffer.from(String(token || ''), 'base64').toString('utf8')
  const parts = decoded.split(':')
  return parts[0] || ''
}

const app = createApp()
await app.ready()

let createdUserId = ''
let createdEmail = ''

try {
  const email = `reg_${crypto.randomBytes(4).toString('hex')}@example.com`
  const password = 'Abcdefg1'
  createdEmail = email

  const captchaRes = await app.inject({ method: 'GET', url: '/auth/captcha' })
  assert.equal(captchaRes.statusCode, 200)
  const captchaBody = captchaRes.json()
  const captcha = decodeCaptchaAnswer(captchaBody.token)

  const sendRes = await app.inject({
    method: 'POST',
    url: '/auth/register/send-code',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email, captcha, captchaToken: captchaBody.token }),
  })
  assert.equal(sendRes.statusCode, 200)
  const sendBody = sendRes.json()
  assert.equal(sendBody.ok, true)
  assert.equal(typeof sendBody.debugCode, 'string')
  assert.ok(sendBody.debugCode.length >= 4)

  const registerRes = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email, password, emailCode: sendBody.debugCode }),
  })
  assert.equal(registerRes.statusCode, 200)
  const registerBody = registerRes.json()
  assert.equal(registerBody.ok, true)

  {
    const r = await pool.query('select id, name from users where email = $1 limit 1', [email])
    assert.equal(r.rowCount, 1)
    const row = r.rows[0] || {}
    createdUserId = String(row.id || '')
    const nickname = String(row.name || '')
    assert.ok(createdUserId)
    assert.ok(nickname)
  }

  const dupEmailRes = await app.inject({
    method: 'POST',
    url: '/auth/register',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email, password, emailCode: sendBody.debugCode }),
  })
  assert.equal(dupEmailRes.statusCode, 400)
  const dupEmailBody = dupEmailRes.json()
  assert.equal(dupEmailBody.code, 'EMAIL_EXISTS')

  const captchaResExist = await app.inject({ method: 'GET', url: '/auth/captcha' })
  assert.equal(captchaResExist.statusCode, 200)
  const captchaBodyExist = captchaResExist.json()
  const captchaExist = decodeCaptchaAnswer(captchaBodyExist.token)

  const sendResExist = await app.inject({
    method: 'POST',
    url: '/auth/register/send-code',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({ email, captcha: captchaExist, captchaToken: captchaBodyExist.token }),
  })
  assert.equal(sendResExist.statusCode, 400)
  const sendBodyExist = sendResExist.json()
  assert.equal(sendBodyExist.code, 'EMAIL_EXISTS')

} finally {
  if (createdUserId) await pool.query('delete from users where id = $1', [createdUserId])
  else if (createdEmail) await pool.query('delete from users where email = $1', [createdEmail])
  await app.close()
}
