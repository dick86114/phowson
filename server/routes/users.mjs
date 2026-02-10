import { pool } from '../db.mjs';
import { upsertUser } from '../db/users.mjs';
import { badRequest } from '../lib/http_errors.mjs';
import { notFound } from '../lib/http_errors.mjs';
import { normalizeRole } from '../lib/roles.mjs';
import { hashPassword, verifyPassword } from '../lib/passwords.mjs';
import { requireAdmin, requireMember } from '../plugins/rbac.mjs';
import { deleteSessionsByUserId } from '../db/sessions.mjs';
import crypto from 'node:crypto';

const logOperation = async (operatorId, targetUserId, action, details) => {
  try {
    await pool.query(
      `insert into operation_logs(operator_id, target_user_id, action, details) values ($1, $2, $3, $4)`,
      [operatorId, targetUserId, action, JSON.stringify(details)]
    );
  } catch (e) {
    console.error('Failed to log operation:', e);
  }
};

const normalizeEmail = (email) => {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e) return null;
  if (e.length > 320) throw badRequest('EMAIL_INVALID', '邮箱格式不合法');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw badRequest('EMAIL_INVALID', '邮箱格式不合法');
  return e;
};

const assertAtLeastOneAdmin = async (excludingUserId) => {
  const r = await pool.query(
    'select count(*)::int as c from users where role=$1 and disabled_at is null and id <> $2',
    ['admin', String(excludingUserId ?? '')],
  );
  if ((r.rows[0]?.c ?? 0) <= 0) throw badRequest('LAST_ADMIN_PROTECTED', '必须至少保留一个管理员');
};

export const registerUserRoutes = async (app) => {
  app.get('/users/page', {
    preHandler: requireAdmin(),
    schema: {
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'family', 'all'] },
          status: { type: 'string', enum: ['enabled', 'disabled', 'all'] },
          sort: { type: 'string', enum: ['newest', 'oldest', 'active'] },
          limit: { type: 'integer', minimum: 1, maximum: 200 },
          offset: { type: 'integer', minimum: 0 },
        },
      },
    },
    handler: async (req) => {
      const q = String(req.query?.q ?? '').trim() || null;
      const role = String(req.query?.role ?? 'all').trim() || 'all';
      const status = String(req.query?.status ?? 'all').trim() || 'all';
      const sort = String(req.query?.sort ?? 'newest').trim();
      const limit = Math.max(1, Math.min(200, Number(req.query?.limit ?? 50) || 50));
      const offset = Math.max(0, Number(req.query?.offset ?? 0) || 0);

      const where = [];
      const args = [];
      let i = 1;

      if (role !== 'all') {
        const normalized = normalizeRole(role);
        if (!normalized) throw badRequest('ROLE_INVALID', '角色不合法');
        where.push(`role = $${i++}`);
        args.push(normalized);
      }

      if (q) {
        where.push(`(id ilike $${i} or name ilike $${i} or email ilike $${i})`);
        args.push(`%${q}%`);
        i += 1;
      }

      if (status !== 'all') {
        const allowed = new Set(['enabled', 'disabled', 'all']);
        if (!allowed.has(status)) throw badRequest('STATUS_INVALID', 'status 不合法');
        where.push(status === 'enabled' ? 'disabled_at is null' : 'disabled_at is not null');
      }

      const whereSql = where.length ? `where ${where.join(' and ')}` : '';

      const totalRes = await pool.query(
        `
          select count(*)::int as total
          from users
          ${whereSql}
        `,
        args,
      );
      const total = Number(totalRes.rows?.[0]?.total ?? 0) || 0;

      let orderBy = 'created_at desc';
      if (sort === 'oldest') orderBy = 'created_at asc';
      else if (sort === 'active') orderBy = 'last_login_at desc nulls last';

      const itemsRes = await pool.query(
        `
          select
            id,
            name,
            role,
            coalesce(avatar_url, '/media/avatars/' || id) as avatar,
            email,
            disabled_at as "disabledAt",
            created_at as "createdAt",
            last_login_at as "lastLoginAt"
          from users
          ${whereSql}
          order by ${orderBy}
          limit $${i} offset $${i + 1}
        `,
        [...args, limit, offset],
      );

      return { items: itemsRes.rows || [], total, limit, offset };
    },
  });

  app.get('/users/:id/logs', {
    preHandler: requireAdmin(),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
    },
    handler: async (req) => {
      const id = String(req.params.id);
      const r = await pool.query(
        `
          select
            l.id,
            l.action,
            l.details,
            l.created_at as "createdAt",
            u.name as "operatorName"
          from operation_logs l
          left join users u on u.id = l.operator_id
          where l.target_user_id = $1
          order by l.created_at desc
          limit 100
        `,
        [id]
      );
      return r.rows;
    },
  });

  app.get('/me/profile', {
    preHandler: requireMember(),
    handler: async (req) => {
      const user = req.authUser;
      await upsertUser(user);
      const r = await pool.query(
        `
          select
            id,
            name,
            role,
            coalesce(avatar_url, '/media/avatars/' || id) as avatar,
            email,
            created_at as "createdAt"
          from users
          where id = $1
          limit 1
        `,
        [user.id],
      );
      if (!r.rowCount) throw notFound('USER_NOT_FOUND', '用户不存在');
      return r.rows[0];
    },
  });

  app.patch('/me/profile', {
    preHandler: requireMember(),
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 80 },
        },
      },
    },
    handler: async (req) => {
      const user = req.authUser;
      await upsertUser(user);
      const name = String(req.body?.name ?? '').trim();
      if (!name) throw badRequest('NAME_REQUIRED', '显示名称不能为空');
      const r = await pool.query(
        `
          update users set name = $2
          where id = $1
          returning
            id,
            name,
            role,
            coalesce(avatar_url, '/media/avatars/' || id) as avatar,
            email,
            created_at as "createdAt"
        `,
        [user.id, name],
      );
      if (!r.rowCount) throw notFound('USER_NOT_FOUND', '用户不存在');
      return r.rows[0];
    },
  });

  app.post('/me/profile/password', {
    preHandler: requireMember(),
    schema: {
      body: {
        type: 'object',
        required: ['newPassword'],
        properties: {
          currentPassword: { type: 'string', maxLength: 2000 },
          newPassword: { type: 'string', minLength: 8, maxLength: 2000 },
        },
      },
    },
    handler: async (req) => {
      const user = req.authUser;
      await upsertUser(user);

      const currentPassword = String(req.body?.currentPassword ?? '');
      const newPassword = String(req.body?.newPassword ?? '');
      if (newPassword.length < 8) throw badRequest('PASSWORD_TOO_SHORT', '新密码至少 8 位');
      if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) throw badRequest('PASSWORD_WEAK', '新密码需包含字母与数字');

      const r = await pool.query('select password_hash from users where id=$1 limit 1', [user.id]);
      if (!r.rowCount) throw notFound('USER_NOT_FOUND', '用户不存在');
      const passwordHash = r.rows[0]?.password_hash ? String(r.rows[0].password_hash) : '';
      if (passwordHash) {
        if (!currentPassword) throw badRequest('CURRENT_PASSWORD_REQUIRED', '请输入当前密码');
        if (!verifyPassword(currentPassword, passwordHash)) throw badRequest('CURRENT_PASSWORD_INVALID', '当前密码错误');
      }

      await pool.query('update users set password_hash=$2 where id=$1', [user.id, hashPassword(newPassword)]);
      return { ok: true };
    },
  });

  app.get('/users', {
    preHandler: requireAdmin(),
    handler: async () => {
      const r = await pool.query(
        `
          select
            id,
            name,
            role,
            coalesce(avatar_url, '/media/avatars/' || id) as avatar,
            email,
            disabled_at as "disabledAt",
            created_at as "createdAt"
          from users
          order by created_at desc
        `,
      );
      return r.rows;
    },
  });

  app.patch('/users/:id/status', {
    preHandler: requireAdmin(),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
      body: {
        type: 'object',
        required: ['disabled'],
        properties: {
          disabled: { type: 'boolean' },
        },
      },
    },
    handler: async (req) => {
      const id = String(req.params.id);
      const disabled = Boolean(req.body?.disabled);
      const acting = req.authUser;
      if (acting?.id && String(acting.id) === id) throw badRequest('CANNOT_DISABLE_SELF', '不能禁用当前登录用户');

      const existing = await pool.query('select role, disabled_at from users where id=$1', [id]);
      if (!existing.rowCount) throw notFound('USER_NOT_FOUND', '用户不存在');
      const prevRole = String(existing.rows[0].role);

      if (disabled && prevRole === 'admin') {
        await assertAtLeastOneAdmin(id);
      }

      const nextDisabledAt = disabled ? 'now()' : 'null';
      const r = await pool.query(
        `
          update users set disabled_at = ${nextDisabledAt}
          where id = $1
          returning id, name, role, coalesce(avatar_url, '/media/avatars/' || id) as avatar, email, disabled_at as "disabledAt", created_at as "createdAt"
        `,
        [id],
      );

      if (disabled) {
        try {
          await deleteSessionsByUserId(id);
        } catch {}
      }

      await logOperation(acting.id, id, disabled ? 'disable_user' : 'enable_user', { prevRole });

      return r.rows[0];
    },
  });

  app.post('/users', {
    preHandler: requireAdmin(),
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          id: { type: 'string', minLength: 1, maxLength: 128 },
          name: { type: 'string', minLength: 1, maxLength: 80 },
          email: { type: 'string', minLength: 3, maxLength: 320 },
          role: { type: 'string', enum: ['admin', 'family'] },
          password: { type: 'string', minLength: 6, maxLength: 2000 },
        },
      },
    },
    handler: async (req, reply) => {
      const id = String(req.body?.id ?? '').trim() || crypto.randomUUID();
      const name = String(req.body?.name ?? '').trim();
      if (!name) throw badRequest('NAME_REQUIRED', '用户名不能为空');
      const email = normalizeEmail(req.body?.email);
      if (!email) throw badRequest('EMAIL_REQUIRED', '邮箱不能为空');
      const password = String(req.body?.password ?? '');
      if (password.length < 6) throw badRequest('PASSWORD_TOO_SHORT', '密码至少 6 位');
      const role = normalizeRole(req.body?.role ?? 'family');
      if (!role || (role !== 'admin' && role !== 'family')) throw badRequest('ROLE_INVALID', '角色不合法');

      const passwordHash = hashPassword(password);
      const r = await pool.query(
        `
          insert into users(id, name, role, email, password_hash)
          values ($1,$2,$3,$4,$5)
          returning id, name, role, coalesce(avatar_url, '/media/avatars/' || id) as avatar, email, created_at as "createdAt"
        `,
        [id, name, role, email, passwordHash],
      );
      
      await logOperation(req.authUser.id, id, 'create_user', { name, email, role });

      return reply.code(201).send(r.rows[0]);
    },
  });

  app.patch('/users/:id', {
    preHandler: requireAdmin(),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 80 },
          email: { type: 'string', minLength: 3, maxLength: 320 },
          role: { type: 'string', enum: ['admin', 'family'] },
        },
      },
    },
    handler: async (req) => {
      const id = String(req.params.id);
      const name = req.body?.name != null ? String(req.body.name).trim() : null;
      const email = req.body?.email != null ? normalizeEmail(req.body.email) : null;
      const role = req.body?.role != null ? normalizeRole(req.body.role) : null;
      if (name != null && !name) throw badRequest('NAME_REQUIRED', '用户名不能为空');
      if (req.body?.role != null && !role) throw badRequest('ROLE_INVALID', '角色不合法');
      if (role && role !== 'admin' && role !== 'family') throw badRequest('ROLE_INVALID', '角色不合法');

      const existing = await pool.query('select role from users where id=$1', [id]);
      if (!existing.rowCount) throw notFound('USER_NOT_FOUND', '用户不存在');
      const prevRole = String(existing.rows[0].role);
      if (prevRole === 'admin' && role === 'family') {
        await assertAtLeastOneAdmin(id);
      }

      const r = await pool.query(
        `
          update users set
            name = coalesce($2, name),
            email = coalesce($3, email),
            role = coalesce($4, role)
          where id = $1
          returning id, name, role, coalesce(avatar_url, '/media/avatars/' || id) as avatar, email, created_at as "createdAt"
        `,
        [id, name, email, role],
      );
      
      await logOperation(req.authUser.id, id, 'update_user', { 
        name: name || undefined, 
        email: email || undefined, 
        role: role || undefined 
      });

      return r.rows[0];
    },
  });

  app.post('/users/:id/password', {
    preHandler: requireAdmin(),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          password: { type: 'string', minLength: 6, maxLength: 2000 },
        },
      },
    },
    handler: async (req) => {
      const id = String(req.params.id);
      const password = String(req.body?.password ?? '');
      if (password.length < 6) throw badRequest('PASSWORD_TOO_SHORT', '密码至少 6 位');

      const exists = await pool.query('select 1 from users where id=$1', [id]);
      if (!exists.rowCount) throw notFound('USER_NOT_FOUND', '用户不存在');

      await pool.query('update users set password_hash=$2 where id=$1', [id, hashPassword(password)]);
      
      await logOperation(req.authUser.id, id, 'reset_password', {});

      return { ok: true };
    },
  });

  app.delete('/users/:id', {
    preHandler: requireAdmin(),
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', minLength: 1 } },
      },
    },
    handler: async (req) => {
      const id = String(req.params.id);
      const acting = req.authUser;
      if (acting?.id && String(acting.id) === id) throw badRequest('CANNOT_DELETE_SELF', '不能删除当前登录用户');

      const existing = await pool.query('select role from users where id=$1', [id]);
      if (!existing.rowCount) throw notFound('USER_NOT_FOUND', '用户不存在');
      const prevRole = String(existing.rows[0].role);
      if (prevRole === 'admin') await assertAtLeastOneAdmin(id);

      await pool.query('delete from users where id=$1', [id]);
      
      await logOperation(acting.id, id, 'delete_user', { prevRole });

      return { ok: true };
    },
  });

  app.post('/users/:id/avatar', {
    preHandler: requireAdmin(),
    handler: async (req) => {
      if (!req.isMultipart()) throw badRequest('INVALID_CONTENT_TYPE', '需要 multipart/form-data');
      const id = String(req.params.id);
      
      const exists = await pool.query('select 1 from users where id=$1', [id]);
      if (!exists.rowCount) throw notFound('USER_NOT_FOUND', '用户不存在');

      let avatarFile = null;
      for await (const part of req.parts()) {
        if (part.type === 'file' && part.fieldname === 'avatar') {
          const buffer = await part.toBuffer();
          avatarFile = {
            buffer,
            mimetype: part.mimetype,
            filename: part.filename,
          };
        } else if (part.type === 'file') {
          await part.toBuffer();
        }
      }

      if (!avatarFile) throw badRequest('AVATAR_REQUIRED', '缺少头像文件');

      const buffer = avatarFile.buffer;
      const mime = avatarFile.mimetype || null;
      const url = `/media/avatars/${id}`;
      
      await pool.query('update users set avatar_mime=$2, avatar_bytes=$3, avatar_url=$4 where id=$1', [id, mime, buffer, url]);
      
      await logOperation(req.authUser.id, id, 'update_user_avatar', {});

      return { avatar: url };
    },
  });

  app.post('/users/avatar', {
    preHandler: requireMember(),
    handler: async (req) => {
      if (!req.isMultipart()) throw badRequest('INVALID_CONTENT_TYPE', '需要 multipart/form-data');

    const user = req.authUser;
    await upsertUser(user);

    let avatarFile = null;
    for await (const part of req.parts()) {
      if (part.type === 'file' && part.fieldname === 'avatar') {
        const buffer = await part.toBuffer();
        avatarFile = {
          buffer,
          mimetype: part.mimetype,
          filename: part.filename,
        };
      } else if (part.type === 'file') {
        await part.toBuffer();
      }
    }

    if (!avatarFile) throw badRequest('AVATAR_REQUIRED', '缺少头像文件');

    const buffer = avatarFile.buffer;
    const mime = avatarFile.mimetype || null;
    const url = `/media/avatars/${user.id}`;
    await pool.query('update users set avatar_mime=$2, avatar_bytes=$3, avatar_url=$4 where id=$1', [user.id, mime, buffer, url]);
      return { avatar: url };
    },
  });
};
