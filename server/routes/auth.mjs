import { pool } from '../db.mjs';
import { badRequest, unauthorized } from '../lib/http_errors.mjs';
import { normalizeRole } from '../lib/roles.mjs';
import { hashPassword, verifyPassword } from '../lib/passwords.mjs';
import { generateToken, hashToken } from '../lib/tokens.mjs';
import { createSession, deleteSession } from '../db/sessions.mjs';

const getBearerToken = (req) => {
  const auth = String(req.headers.authorization ?? '').trim();
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return m[1].trim();
};

const ensureAuthSchemaReady = async () => {
  const r = await pool.query(`
    select
      to_regclass('public.sessions') is not null as has_sessions,
      exists(
        select 1 from information_schema.columns
        where table_schema='public' and table_name='users' and column_name='email'
      ) as has_email
  `);
  const row = r.rows[0] || {};
  return Boolean(row.has_sessions) && Boolean(row.has_email);
};

const ensureAdminBootstrap = async () => {
  const email = String(process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD ?? '');
  if (!email || !password) return;
  if (!(await ensureAuthSchemaReady())) return;

  const passwordHash = hashPassword(password);
  await pool.query(
    `
      insert into users(id, name, role, email, password_hash)
      values ('admin', '管理员', 'admin', $1, $2)
      on conflict (id) do update set
        name = excluded.name,
        role = excluded.role,
        email = excluded.email,
        password_hash = excluded.password_hash
    `,
    [email, passwordHash],
  );
};

export const registerAuthRoutes = async (app) => {
  app.addHook('onReady', async () => {
    try {
      await ensureAdminBootstrap();
    } catch (e) {
      app.log.warn({ err: e }, 'auth bootstrap skipped');
    }
  });

  app.post('/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', minLength: 3, maxLength: 320 },
          password: { type: 'string', minLength: 1, maxLength: 2000 },
        },
      },
    },
    handler: async (req) => {
      if (!(await ensureAuthSchemaReady())) throw badRequest('AUTH_NOT_READY', '认证表结构未初始化');

      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const password = String(req.body?.password ?? '');
      if (!email) throw badRequest('EMAIL_REQUIRED', '邮箱不能为空');
      if (!password) throw badRequest('PASSWORD_REQUIRED', '密码不能为空');

      const r = await pool.query(
        `
          select id, name, role, coalesce(avatar_url, '/media/avatars/' || id) as avatar, password_hash
          from users
          where email = $1
          limit 1
        `,
        [email],
      );
      if (!r.rowCount) throw unauthorized('INVALID_CREDENTIALS', '账号或密码错误');

      const u = r.rows[0];
      if (!verifyPassword(password, u.password_hash)) throw unauthorized('INVALID_CREDENTIALS', '账号或密码错误');

      const role = normalizeRole(u.role);
      if (!role) throw unauthorized('INVALID_ACCOUNT', '账号角色无效');

      const token = generateToken();
      await createSession(hashToken(token), String(u.id), process.env.SESSION_TTL_DAYS);

      return {
        token,
        user: {
          id: String(u.id),
          name: String(u.name ?? u.id),
          role,
          avatar: String(u.avatar ?? ''),
        },
      };
    },
  });

  app.get('/auth/me', async (req) => {
    const user = req.authUser;
    if (!user?.id) throw unauthorized('UNAUTHORIZED', '未登录');
    return { user };
  });

  app.post('/auth/logout', async (req) => {
    const token = getBearerToken(req);
    if (token) {
      try {
        await deleteSession(hashToken(token));
      } catch {
        return { ok: true };
      }
    }
    return { ok: true };
  });
};
