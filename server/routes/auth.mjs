import { pool } from '../db.mjs';
import { HttpError, badRequest, unauthorized } from '../lib/http_errors.mjs';
import { normalizeRole } from '../lib/roles.mjs';
import { hashPassword, verifyPassword } from '../lib/passwords.mjs';
import { generateToken, hashToken } from '../lib/tokens.mjs';
import { createSession, deleteSession } from '../db/sessions.mjs';
import { createCaptcha, verifyCaptcha } from '../lib/captcha.mjs';
import sharp from 'sharp';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';

const readCookie = (req, name) => {
  const raw = String(req.headers.cookie ?? '').trim();
  if (!raw) return null;
  const parts = raw.split(';');
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    const idx = p.indexOf('=');
    if (idx <= 0) continue;
    const k = p.slice(0, idx).trim();
    if (k !== name) continue;
    const v = p.slice(idx + 1).trim();
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return null;
};

const getBearerToken = (req) => {
  const auth = String(req.headers.authorization ?? '').trim();
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }

  const cookieToken = readCookie(req, 'phowson_token') || readCookie(req, 'photologs_token');
  if (cookieToken) return String(cookieToken).trim() || null;

  return null;
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

const toBool = (raw, fallback = false) => {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return fallback;
  if (['1', 'true', 'yes', 'y', 'on'].includes(v)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(v)) return false;
  if (['ssl', 'tls'].includes(v)) return true;
  return fallback;
};

const getClientIp = (req) => {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '').trim();
  const ip = forwarded ? forwarded.split(',')[0].trim() : (req.ip ?? '');
  return String(ip || '').trim();
};

const EMAIL_CODE_SECRET = process.env.EMAIL_CODE_SECRET || crypto.randomBytes(32).toString('hex');

const hashEmailCode = (email, code) => {
  return crypto.createHmac('sha256', EMAIL_CODE_SECRET).update(`${String(email)}:${String(code)}`).digest('hex');
};

const generateUniqueNickname = async () => {
  for (let i = 0; i < 20; i += 1) {
    const suffix = crypto.randomBytes(4).toString('hex');
    const name = `用户${suffix}`;
    const existing = await pool.query('select 1 from users where lower(name) = lower($1) limit 1', [name]);
    if (!existing.rowCount) return name;
  }
  const fallback = `用户${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  return fallback.slice(0, 50);
};

const sendEmail = async ({ to, subject, text, html }) => {
  const provider = String(process.env.EMAIL_PROVIDER || '').trim().toLowerCase();
  if (!provider || provider === 'log') return { ok: true };
  if (provider !== 'smtp') throw new HttpError(501, 'EMAIL_PROVIDER_UNSUPPORTED', '邮箱发送未配置或不支持');

  const host = String(process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const secure = toBool(process.env.SMTP_SECURE, port === 465);
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '');
  const from = String(process.env.EMAIL_FROM || user).trim();
  const fromName = String(process.env.EMAIL_FROM_NAME || '').trim();

  if (!host || !port || !user || !pass || !from) throw new HttpError(501, 'EMAIL_NOT_CONFIGURED', '未配置邮箱发送环境变量');

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  const fromHeader = fromName ? `"${fromName}" <${from}>` : from;
  await transport.sendMail({ from: fromHeader, to, subject, text, html });
  return { ok: true };
};

export const registerAuthRoutes = async (app) => {
  app.addHook('onReady', async () => {
    try {
      await ensureAdminBootstrap();
    } catch (e) {
      app.log.warn({ err: e }, 'auth bootstrap skipped');
    }
  });

  app.post('/auth/register/send-code', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'captcha', 'captchaToken'],
        properties: {
          email: { type: 'string', minLength: 3, maxLength: 320 },
          captcha: { type: 'string', minLength: 1, maxLength: 20 },
          captchaToken: { type: 'string', minLength: 1, maxLength: 2000 },
        },
      },
    },
    handler: async (req) => {
      if (!(await ensureAuthSchemaReady())) throw badRequest('AUTH_NOT_READY', '认证表结构未初始化');

      const email = String(req.body.email).trim().toLowerCase();
      const captcha = String(req.body.captcha).trim();
      const captchaToken = String(req.body.captchaToken).trim();
      if (!email) throw badRequest('EMAIL_REQUIRED', '邮箱不能为空');
      if (!verifyCaptcha(captcha, captchaToken)) throw badRequest('CAPTCHA_INVALID', '验证码错误');

      const existingEmail = await pool.query('select 1 from users where email = $1', [email]);
      if (existingEmail.rowCount > 0) {
        throw badRequest('EMAIL_EXISTS', '邮箱已被注册');
      }

      const now = new Date();
      const rl = await pool.query(
        `select last_sent_at from email_verification_codes where email = $1 limit 1`,
        [email],
      );
      if (rl.rowCount) {
        const last = rl.rows[0]?.last_sent_at ? new Date(rl.rows[0].last_sent_at) : null;
        if (last && now.getTime() - last.getTime() < 60_000) throw badRequest('TOO_MANY_REQUESTS', '请求过于频繁，请稍后再试');
      }

      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      const codeHash = hashEmailCode(email, code);
      const expiresAt = new Date(now.getTime() + 10 * 60_000);
      const ip = getClientIp(req);
      const ua = String(req.headers['user-agent'] ?? '').trim();

      await pool.query(
        `
          insert into email_verification_codes(email, code_hash, expires_at, attempts, blocked_until, last_sent_at, created_at, send_ip, send_ua)
          values ($1, $2, $3, 0, null, now(), now(), $4, $5)
          on conflict (email) do update set
            code_hash = excluded.code_hash,
            expires_at = excluded.expires_at,
            attempts = 0,
            blocked_until = null,
            last_sent_at = now(),
            send_ip = excluded.send_ip,
            send_ua = excluded.send_ua
        `,
        [email, codeHash, expiresAt, ip || null, ua || null],
      );

      const minutes = 10;
      const subject = '【浮生】注册验证码';
      const text = `你的注册验证码是：${code}\n有效期 ${minutes} 分钟。\n如果不是你本人操作，请忽略此邮件。`;
      const html = `<div style="font-family: -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.6"><p>你的注册验证码是：</p><p style="font-size:28px;font-weight:700;letter-spacing:2px">${code}</p><p>有效期 ${minutes} 分钟。</p><p style="color:#666">如果不是你本人操作，请忽略此邮件。</p></div>`;

      try {
        await sendEmail({ to: email, subject, text, html });
      } catch {
        throw new HttpError(500, 'EMAIL_SEND_FAILED', '验证码发送失败，请稍后重试');
      }

      const debugEnabled = toBool(process.env.EMAIL_CODE_DEBUG, false);
      if (debugEnabled) return { ok: true, debugCode: code };
      return { ok: true };
    },
  });

  app.post('/auth/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'emailCode'],
        properties: {
          email: { type: 'string', minLength: 3, maxLength: 320 },
          password: { type: 'string', minLength: 6, maxLength: 100 },
          emailCode: { type: 'string', minLength: 4, maxLength: 10 },
        },
      },
    },
    handler: async (req) => {
      if (!(await ensureAuthSchemaReady())) throw badRequest('AUTH_NOT_READY', '认证表结构未初始化');
      
      const email = String(req.body.email).trim().toLowerCase();
      const password = String(req.body.password);
      const emailCode = String(req.body.emailCode ?? '').trim();
      
      if (!email) throw badRequest('EMAIL_REQUIRED', '邮箱不能为空');
      if (!password) throw badRequest('PASSWORD_REQUIRED', '密码不能为空');
      if (!emailCode) throw badRequest('EMAIL_CODE_REQUIRED', '邮箱验证码不能为空');
      
      const existingEmail = await pool.query('select 1 from users where email = $1', [email]);
      if (existingEmail.rowCount > 0) throw badRequest('EMAIL_EXISTS', '邮箱已被注册');

      const codeRowRes = await pool.query(
        `select code_hash, expires_at, attempts, blocked_until from email_verification_codes where email = $1 limit 1`,
        [email],
      );
      if (!codeRowRes.rowCount) throw badRequest('EMAIL_CODE_REQUIRED', '请先获取邮箱验证码');
      const codeRow = codeRowRes.rows[0] || {};
      const blockedUntil = codeRow.blocked_until ? new Date(codeRow.blocked_until) : null;
      if (blockedUntil && Date.now() < blockedUntil.getTime()) throw badRequest('EMAIL_CODE_BLOCKED', '验证码错误次数过多，请稍后再试');
      const expiresAt = codeRow.expires_at ? new Date(codeRow.expires_at) : null;
      if (!expiresAt || Date.now() > expiresAt.getTime()) throw badRequest('EMAIL_CODE_EXPIRED', '验证码已过期，请重新获取');

      const expected = String(codeRow.code_hash || '');
      const provided = hashEmailCode(email, emailCode);
      if (!expected || expected !== provided) {
        const attempts = Number(codeRow.attempts || 0) + 1;
        const shouldBlock = attempts >= 5;
        await pool.query(
          `update email_verification_codes
           set attempts = $2,
               blocked_until = case when $3 then now() + interval '30 minutes' else blocked_until end
           where email = $1`,
          [email, attempts, shouldBlock],
        );
        throw badRequest('EMAIL_CODE_INVALID', '邮箱验证码错误');
      }

      await pool.query('delete from email_verification_codes where email = $1', [email]);
      
      const id = crypto.randomUUID();
      const passwordHash = hashPassword(password);
      const name = await generateUniqueNickname();
      
      await pool.query(
        `insert into users(id, name, email, password_hash, role, status, created_at)
         values ($1, $2, $3, $4, 'family', 'pending', now())`,
        [id, name, email, passwordHash]
      );
      
      return { ok: true, message: '注册成功，请等待管理员审核' };
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
    handler: async (req, reply) => {
      if (!(await ensureAuthSchemaReady())) throw badRequest('AUTH_NOT_READY', '认证表结构未初始化');

      const email = String(req.body?.email ?? '').trim().toLowerCase();
      const password = String(req.body?.password ?? '');
      if (!email) throw badRequest('EMAIL_REQUIRED', '邮箱不能为空');
      if (!password) throw badRequest('PASSWORD_REQUIRED', '密码不能为空');

      const r = await pool.query(
        `
          select id, name, role, email, coalesce(avatar_url, '/media/avatars/' || id) as avatar, password_hash, disabled_at, status
          from users
          where email = $1
          limit 1
        `,
        [email],
      );
      if (!r.rowCount) throw unauthorized('INVALID_CREDENTIALS', '账号或密码错误');

      const u = r.rows[0];
      if (u.disabled_at) throw unauthorized('ACCOUNT_DISABLED', '账号已禁用');
      if (u.status === 'pending') throw unauthorized('ACCOUNT_PENDING', '账号审核中，请联系管理员');
      if (u.status === 'disabled') throw unauthorized('ACCOUNT_DISABLED', '账号已禁用');
      if (!verifyPassword(password, u.password_hash)) throw unauthorized('INVALID_CREDENTIALS', '账号或密码错误');

      const role = normalizeRole(u.role);
      if (!role) throw unauthorized('INVALID_ACCOUNT', '账号角色无效');

      const token = generateToken();
      await createSession(hashToken(token), String(u.id), process.env.SESSION_TTL_DAYS);
      
      // Update last_login_at
      await pool.query('update users set last_login_at = now() where id = $1', [u.id]);

      const ttlDaysRaw = Number(process.env.SESSION_TTL_DAYS);
      const ttlDays = Number.isFinite(ttlDaysRaw) && ttlDaysRaw > 0 ? ttlDaysRaw : 30;
      const maxAge = Math.floor(ttlDays * 24 * 60 * 60);
      const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '').trim().toLowerCase();
      const secure = forwardedProto === 'https';
      const cookie = [
        `phowson_token=${encodeURIComponent(token)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        `Max-Age=${maxAge}`,
        secure ? 'Secure' : '',
      ]
        .filter(Boolean)
        .join('; ');
      reply.header('set-cookie', cookie);

      return {
        token,
        user: {
          id: String(u.id),
          name: String(u.name ?? u.id),
          role,
          email: String(u.email ?? ''),
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

  app.post('/auth/logout', async (req, reply) => {
    const token = getBearerToken(req);
    if (token) {
      try {
        await deleteSession(hashToken(token));
      } catch {
        const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '').trim().toLowerCase();
        const secure = forwardedProto === 'https';
        const clearCookie = ['phowson_token=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0', secure ? 'Secure' : '']
          .filter(Boolean)
          .join('; ');
        reply.header('set-cookie', clearCookie);
        return { ok: true };
      }
    }
    {
      const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '').trim().toLowerCase();
      const secure = forwardedProto === 'https';
      const clearCookie = ['phowson_token=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0', secure ? 'Secure' : '']
        .filter(Boolean)
        .join('; ');
      reply.header('set-cookie', clearCookie);
    }
    return { ok: true };
  });

  app.get('/auth/captcha', async (req) => {
    const q = req.query || {};
    const format = String(q.format ?? 'svg').trim().toLowerCase();
    const captcha = createCaptcha();
    if (!format || format === 'svg') return captcha;

    if (format === 'base64' || format === 'png' || format === 'png_base64') {
      try {
        const png = await sharp(Buffer.from(String(captcha.svg ?? ''), 'utf8')).png().toBuffer();
        return { token: captcha.token, pngBase64: png.toString('base64'), mimeType: 'image/png' };
      } catch {
        throw new HttpError(500, 'CAPTCHA_RENDER_FAILED', '验证码图片生成失败');
      }
    }

    throw badRequest('INVALID_CAPTCHA_FORMAT', 'format 参数不支持');
  });
};
