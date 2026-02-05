import { loadEnvIfNeeded } from './lib/load_env.mjs';
import { pool } from './db.mjs';

loadEnvIfNeeded();

(async () => {
  const result = await pool.query('SELECT id, email, role FROM users LIMIT 5;');
  console.log('用户列表:');
  console.table(result.rows);
  await pool.end();
})();
