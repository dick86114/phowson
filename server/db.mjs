import pg from 'pg';
import { loadEnvIfNeeded } from './lib/load_env.mjs';

loadEnvIfNeeded();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('缺少 DATABASE_URL');
}

const { Pool } = pg;

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
});

export const closePool = async () => {
  await pool.end();
};
