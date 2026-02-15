import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

const readIgnore = async () => {
  const file = path.join(repoRoot, '.ossignore')
  const raw = await fs.readFile(file, 'utf8').catch(() => '')
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
  const normalized = lines.map((l) => l.replace(/\\/g, '/'))
  return normalized
}

const shouldIgnore = (rel, rules) => {
  const p = rel.replace(/\\/g, '/')
  for (const r of rules) {
    if (r.endsWith('/')) {
      if (p === r.slice(0, -1) || p.startsWith(r)) return true
      continue
    }
    if (p === r) return true
    if (path.posix.basename(p) === r) return true
  }
  return false
}

const copyFile = async (src, dst) => {
  await fs.mkdir(path.dirname(dst), { recursive: true })
  await fs.copyFile(src, dst)
}

const walk = async (dir, rules, outDir, relBase = '') => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const ent of entries) {
    const abs = path.join(dir, ent.name)
    const rel = relBase ? `${relBase}/${ent.name}` : ent.name
    if (shouldIgnore(rel, rules)) continue
    const out = path.join(outDir, rel)
    if (ent.isDirectory()) {
      await walk(abs, rules, outDir, rel)
    } else if (ent.isFile()) {
      await copyFile(abs, out)
    }
  }
}

const main = async () => {
  const outDir = path.resolve(repoRoot, 'dist-oss')
  await fs.rm(outDir, { recursive: true, force: true })
  const rules = await readIgnore()
  await walk(repoRoot, rules, outDir)
  process.stdout.write(`${outDir}\n`)
}

await main()

