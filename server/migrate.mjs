import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { loadEnvIfNeeded } from './lib/load_env.mjs';

loadEnvIfNeeded();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, 'migrations');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('缺少 DATABASE_URL');
}

const { Pool } = pg;
const pool = new Pool({ connectionString: databaseUrl });

const main = async () => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `);
    await client.query('commit');

    const applied = await client.query('select version from schema_migrations');
    const appliedSet = new Set(applied.rows.map(r => String(r.version)));

    const entries = (await readdir(migrationsDir)).filter(f => f.endsWith('.sql')).sort();
    for (const file of entries) {
      const version = file.replace(/\.sql$/, '');
      if (appliedSet.has(version)) continue;

      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations(version) values ($1)', [version]);
        await client.query('commit');
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
};

await main();
