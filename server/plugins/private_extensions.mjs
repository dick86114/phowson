import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const getRepoRoot = () => path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..')

const fileExists = async (p) => {
  try {
    await fs.stat(p)
    return true
  } catch {
    return false
  }
}

const loadPrivateModule = async (repoRoot) => {
  const disabled = String(process.env.PRIVATE_EXTENSIONS_DISABLED || '').trim().toLowerCase()
  if (disabled === '1' || disabled === 'true' || disabled === 'yes') return { ok: true, mod: null }

  const moduleSpecifier = String(process.env.PRIVATE_EXTENSIONS_MODULE || '').trim()
  if (moduleSpecifier) {
    const mod = await import(moduleSpecifier)
    return { ok: true, mod }
  }

  const required = String(process.env.PRIVATE_EXTENSIONS_REQUIRED || '').trim().toLowerCase()
  const isRequired = required === '1' || required === 'true' || required === 'yes'

  const envPath = String(process.env.PRIVATE_EXTENSIONS_PATH || '').trim()
  const candidate = envPath ? path.resolve(repoRoot, envPath) : path.resolve(repoRoot, 'private/server/plugin.mjs')

  if (!(await fileExists(candidate))) {
    if (isRequired) {
      return { ok: false, error: `未找到私有扩展模块: ${candidate}` }
    }
    return { ok: true, mod: null }
  }

  const url = pathToFileURL(candidate).href
  const mod = await import(url)
  return { ok: true, mod }
}

export const registerPrivateExtensions = async (app) => {
  const repoRoot = getRepoRoot()
  const loaded = await loadPrivateModule(repoRoot)
  if (!loaded.ok) {
    app.log.error({ err: loaded.error }, 'private extensions required')
    throw new Error(loaded.error)
  }

  const mod = loaded.mod
  if (!mod) return

  const registerFn = mod.registerPrivateRoutes || mod.default
  if (typeof registerFn !== 'function') {
    app.log.warn('private extensions loaded but no registerPrivateRoutes export')
    return
  }

  await registerFn(app, { repoRoot })
}
