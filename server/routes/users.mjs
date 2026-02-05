import { pool } from '../db.mjs';
import { upsertUser } from '../db/users.mjs';
import { badRequest } from '../lib/http_errors.mjs';
import { notFound } from '../lib/http_errors.mjs';
import { normalizeRole } from '../lib/roles.mjs';
import { hashPassword } from '../lib/passwords.mjs';
import { requireAdmin, requireMember } from '../plugins/rbac.mjs';
import crypto from 'node:crypto';

const normalizeEmail = (email) => {
  const e = String(email ?? '').trim().toLowerCase();
  if (!e) return null;
  if (e.length > 320) throw badRequest('EMAIL_INVALID', '邮箱格式不合法');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw badRequest('EMAIL_INVALID', '邮箱格式不合法');
  return e;
};

const assertAtLeastOneAdmin = async (excludingUserId) => {
  const r = await pool.query('select count(*)::int as c from users where role=$1 and id <> $2', ['admin', String(excludingUserId ?? '')]);
  if ((r.rows[0]?.c ?? 0) <= 0) throw badRequest('LAST_ADMIN_PROTECTED', '必须至少保留一个管理员');
};

export const registerUserRoutes = async (app) => {
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
            created_at as "createdAt"
          from users
          order by created_at desc
        `,
      );
      return r.rows;
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
      return { ok: true };
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
