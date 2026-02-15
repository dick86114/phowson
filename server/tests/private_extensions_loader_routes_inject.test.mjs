import assert from 'node:assert/strict'
import { createApp } from '../app.mjs'

const run = async () => {
  {
    delete process.env.PRIVATE_EXTENSIONS_DISABLED
    delete process.env.PRIVATE_EXTENSIONS_REQUIRED
    process.env.PRIVATE_EXTENSIONS_PATH = 'server/tests/fixtures/no_such_private_plugin.mjs'

    const app = createApp()
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/private/ping' })
    assert.equal(res.statusCode, 404)
    await app.close()
  }

  {
    delete process.env.PRIVATE_EXTENSIONS_DISABLED
    delete process.env.PRIVATE_EXTENSIONS_REQUIRED
    process.env.PRIVATE_EXTENSIONS_PATH = 'server/tests/fixtures/private_plugin_fixture.mjs'

    const app = createApp()
    await app.ready()
    const res = await app.inject({ method: 'GET', url: '/private/ping' })
    assert.equal(res.statusCode, 200)
    const body = res.json()
    assert.deepEqual(body, { ok: true })
    await app.close()
  }
}

await run()

