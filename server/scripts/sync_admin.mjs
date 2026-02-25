import { pool } from '../db.mjs';
import { loadEnvIfNeeded } from '../lib/load_env.mjs';
import { hashPassword } from '../lib/passwords.mjs';

loadEnvIfNeeded();

const ensureAuthSchemaReady = async () => {
  const sessionsExists = await pool.query(
    `
      select 1
      from information_schema.tables
      where table_name = 'sessions'
      limit 1
    `,
  );
  if (sessionsExists.rowCount === 0) throw new Error('认证表未初始化：缺少 sessions');

  const usersColumns = await pool.query(
    `
      select column_name
      from information_schema.columns
      where table_name = 'users'
    `,
  );
  const cols = new Set(usersColumns.rows.map((r) => String(r.column_name)));
  if (!cols.has('email') || !cols.has('password_hash')) throw new Error('认证字段未初始化：缺少 users.email 或 users.password_hash');
};

const main = async () => {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  if (!email || !password) throw new Error('缺少 ADMIN_EMAIL 或 ADMIN_PASSWORD');

  await ensureAuthSchemaReady();

  const passwordHash = await hashPassword(password);
  
  // 仅当 admin 账号不存在时才插入。如果存在，不再强制覆盖。
  // 这允许管理员在系统中修改密码而不被重置。
  await pool.query(
    `
      insert into users(id, name, role, email, password_hash)
      values ('admin', '管理员', 'admin', $1, $2)
      on conflict (id) do nothing
    `,
    [email, passwordHash],
  );
};

await main();
await pool.end();

