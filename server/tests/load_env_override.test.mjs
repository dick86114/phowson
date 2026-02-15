import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { loadEnvIfNeeded } from '../lib/load_env.mjs';

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'phowson-env-'));
const envFile = path.join(tmpDir, '.env.local');

const prevEnvFile = process.env.ENV_FILE;
const prevPort = process.env.PORT;
const prevHost = process.env.HOST;

try {
  await fs.writeFile(envFile, 'HOST=0.0.0.0\nPORT=2615\n', 'utf8');

  process.env.ENV_FILE = envFile;
  process.env.PORT = '3001';
  process.env.HOST = '127.0.0.1';

  loadEnvIfNeeded();

  assert.equal(process.env.PORT, '2615');
  assert.equal(process.env.HOST, '0.0.0.0');
} finally {
  if (prevEnvFile == null) delete process.env.ENV_FILE;
  else process.env.ENV_FILE = prevEnvFile;

  if (prevPort == null) delete process.env.PORT;
  else process.env.PORT = prevPort;

  if (prevHost == null) delete process.env.HOST;
  else process.env.HOST = prevHost;

  await fs.rm(tmpDir, { recursive: true, force: true });
}

