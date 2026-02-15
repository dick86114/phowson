import fs from 'node:fs/promises'
import path from 'node:path'

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')

const ignoreDirs = new Set(['node_modules', '.git', 'dist', 'dist-oss', 'reports', '.trae'])

const patterns = [
  { name: 'private_key_block', re: /-----BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY-----/ },
  { name: 'aws_access_key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'openai_key', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { name: 'google_api_key', re: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
]

const textLike = (p) => {
  const lower = p.toLowerCase()
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.gif')) return false
  if (lower.endsWith('.zip') || lower.endsWith('.gz') || lower.endsWith('.tgz')) return false
  if (lower.endsWith('.pdf') || lower.endsWith('.mp4')) return false
  return true
}

const walk = async (dir, relBase = '') => {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  const out = []
  for (const ent of entries) {
    const abs = path.join(dir, ent.name)
    const rel = relBase ? `${relBase}/${ent.name}` : ent.name
    if (ent.isDirectory()) {
      if (ignoreDirs.has(ent.name)) continue
      out.push(...(await walk(abs, rel)))
    } else if (ent.isFile()) {
      if (!textLike(rel)) continue
      out.push({ abs, rel })
    }
  }
  return out
}

const main = async () => {
  const files = await walk(repoRoot)
  const hits = []
  for (const f of files) {
    const buf = await fs.readFile(f.abs).catch(() => null)
    if (!buf) continue
    const text = buf.toString('utf8')
    for (const p of patterns) {
      if (p.re.test(text)) hits.push({ file: f.rel, pattern: p.name })
    }
  }

  if (!hits.length) {
    process.stdout.write('ok\n')
    return
  }

  for (const h of hits) {
    process.stdout.write(`${h.pattern}\t${h.file}\n`)
  }
  process.exitCode = 1
}

await main()

