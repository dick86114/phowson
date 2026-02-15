import { pool } from '../db.mjs';
import { badRequest, notFound } from '../lib/http_errors.mjs';
import { requireAdmin } from '../plugins/rbac.mjs';

const validateValue = (value) => {
  const v = String(value ?? '').trim();
  if (!v) throw badRequest('CATEGORY_VALUE_REQUIRED', '分类 value 不能为空');
  if (!/^[a-z0-9][a-z0-9_-]{0,39}$/.test(v)) {
    throw badRequest('CATEGORY_VALUE_INVALID', '分类 value 仅支持小写字母/数字/下划线/短横线，且长度不超过 40');
  }
  return v;
};

export const registerCategoryRoutes = async (app) => {
  app.get('/categories', async () => {
    const r = await pool.query(
      `
        select
          c.value,
          c.label,
          c.icon,
          c.sort_order as "sortOrder",
          c.created_at as "createdAt",
          c.updated_at as "updatedAt",
          count(p.id)::int as "photoCount"
        from categories c
        left join photos p on p.category = c.value
        group by c.value
        order by c.sort_order asc, c.created_at asc
      `,
    );
    return r.rows;
  });

  app.post('/categories', {
    preHandler: requireAdmin(),
    schema: {
      body: {
        type: 'object',
        required: ['value', 'label'],
        properties: {
          value: { type: 'string', minLength: 1, maxLength: 40 },
          label: { type: 'string', minLength: 1, maxLength: 80 },
          icon: { type: 'string', maxLength: 50 },
          sortOrder: { type: 'integer' },
        },
      },
    },
    handler: async (req, reply) => {
      const value = validateValue(req.body?.value);
      const label = String(req.body?.label ?? '').trim();
      if (!label) throw badRequest('CATEGORY_LABEL_REQUIRED', '分类 label 不能为空');
      const icon = req.body?.icon ? String(req.body.icon).trim() : null;
      const sortOrder = Number.isFinite(Number(req.body?.sortOrder)) ? Number(req.body.sortOrder) : 0;

      const r = await pool.query(
        `
          insert into categories(value, label, icon, sort_order)
          values ($1,$2,$3,$4)
          returning value, label, icon, sort_order as "sortOrder", created_at as "createdAt", updated_at as "updatedAt"
        `,
        [value, label, icon, sortOrder],
      );

      return reply.code(201).send(r.rows[0]);
    },
  });

  app.patch('/categories/:value', {
    preHandler: requireAdmin(),
    schema: {
      params: {
        type: 'object',
        required: ['value'],
        properties: { value: { type: 'string', minLength: 1, maxLength: 40 } },
      },
      body: {
        type: 'object',
        properties: {
          label: { type: 'string', minLength: 1, maxLength: 80 },
          icon: { type: 'string', maxLength: 50 },
          sortOrder: { type: 'integer' },
        },
      },
    },
    handler: async (req) => {
      const value = validateValue(req.params?.value);
      const label = req.body?.label != null ? String(req.body.label).trim() : null;
      // Note: icon can be empty string to clear it
      const icon = req.body?.icon !== undefined ? (req.body.icon ? String(req.body.icon).trim() : null) : undefined;
      const sortOrder = req.body?.sortOrder != null ? Number(req.body.sortOrder) : null;
      if (label != null && !label) throw badRequest('CATEGORY_LABEL_REQUIRED', '分类 label 不能为空');

      const r = await pool.query(
        `
          update categories set
            label = coalesce($2, label),
            icon = case when $3::boolean then $4 else icon end,
            sort_order = coalesce($5, sort_order)
          where value = $1
          returning value, label, icon, sort_order as "sortOrder", created_at as "createdAt", updated_at as "updatedAt"
        `,
        [value, label, icon !== undefined, icon, Number.isFinite(sortOrder) ? sortOrder : null],
      );
      if (!r.rowCount) throw notFound('CATEGORY_NOT_FOUND', '分类不存在');
      return r.rows[0];
    },
  });

  app.delete('/categories/:value', {
    preHandler: requireAdmin(),
    schema: {
      params: {
        type: 'object',
        required: ['value'],
        properties: { value: { type: 'string', minLength: 1, maxLength: 40 } },
      },
    },
    handler: async (req) => {
      const value = validateValue(req.params?.value);
      if (value === 'uncategorized') throw badRequest('CATEGORY_PROTECTED', '未分类不可删除');

      const exists = await pool.query('select 1 from categories where value=$1', [value]);
      if (!exists.rowCount) throw notFound('CATEGORY_NOT_FOUND', '分类不存在');

      await pool.query('update photos set category=$2 where category=$1', [value, 'uncategorized']);
      await pool.query('delete from categories where value=$1', [value]);
      return { ok: true };
    },
  });
};

