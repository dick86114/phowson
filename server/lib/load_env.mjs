import fs from 'node:fs';
import path from 'node:path';

const parseEnv = (content) => {
  const out = {};
  const lines = String(content || '').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }

    if (key) out[key] = value;
  }
  return out;
};

const applyEnv = (vars) => {
  for (const [k, v] of Object.entries(vars || {})) {
    if (process.env[k] == null || process.env[k] === '') {
      process.env[k] = String(v);
    }
  }
};

const resolveDefaultEnvFile = () => {
  const preferred = String(process.env.ENV_FILE || '').trim();
  if (preferred) return preferred;

  const cwd = process.cwd();
  const rootLocal = path.join(cwd, '.env.local');
  const serverLocal = path.join(cwd, 'server', '.env.local');
  if (fs.existsSync(rootLocal)) return rootLocal;
  if (fs.existsSync(serverLocal)) return serverLocal;
  return null;
};

export const loadEnvIfNeeded = () => {
  const envFile = resolveDefaultEnvFile();
  if (!envFile) return { loaded: false, path: null };

  try {
    const raw = fs.readFileSync(envFile, 'utf8');
    const vars = parseEnv(raw);
    applyEnv(vars);
    return { loaded: true, path: envFile };
  } catch {
    return { loaded: false, path: envFile };
  }
};

