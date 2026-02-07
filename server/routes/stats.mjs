import { pool } from '../db.mjs';
import { badRequest } from '../lib/http_errors.mjs';
import { requireMember } from '../plugins/rbac.mjs';
import { upsertUser } from '../db/users.mjs';

const toIntOrNull = (v) => {
  if (v === undefined || v === null) return null;
  const n = Number.parseInt(String(v), 10);
  if (!Number.isFinite(n)) return null;
  return n;
};

const toMonthRange = (yearRaw, monthRaw) => {
  const now = new Date();
  const year = toIntOrNull(yearRaw) ?? now.getFullYear();
  const month = toIntOrNull(monthRaw) ?? now.getMonth() + 1;
  if (month < 1 || month > 12) throw badRequest('MONTH_INVALID', '月份不合法');

  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return {
    year,
    month,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    monthIso: `${year}-${String(month).padStart(2, '0')}`,
  };
};

export const registerStatsRoutes = async (app) => {
  app.get('/stats/summary', async () => {
    // 基础汇总
    const summary = await pool.query(`
      SELECT 
        (SELECT COUNT(*)::int FROM photos) as total_photos,
        (SELECT COUNT(*)::int FROM users) as total_users,
        (SELECT COALESCE(SUM(likes_count), 0)::int FROM photos) as total_likes,
        (SELECT COUNT(*)::int FROM activity_logs) as total_activities
    `);

    // 分类分布
    const dist = await pool.query(`
      SELECT category, COUNT(*)::int as count 
      FROM photos 
      GROUP BY category 
      ORDER BY count DESC
    `);

    // 最近30天上传趋势
    const trend = await pool.query(`
      SELECT 
        TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') as date,
        COUNT(*)::int as count
      FROM photos
      WHERE created_at > NOW() - INTERVAL '30 days'
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    // 相机型号分布 (TOP 5)
    const cameras = await pool.query(`
      SELECT 
        JSONB_EXTRACT_PATH_TEXT(exif, 'camera') as camera,
        COUNT(*)::int as count
      FROM photos
      WHERE exif IS NOT NULL AND jsonb_typeof(exif) = 'object'
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 5
    `);

    return {
      summary: summary.rows[0],
      categoryDistribution: dist.rows,
      uploadTrend: trend.rows,
      cameraStats: cameras.rows.filter(c => c.camera),
    };
  });

  app.get('/me/analytics/hourly', { preHandler: requireMember() }, async (req) => {
    const user = req.authUser;
    await upsertUser(user);
    const q = req.query || {};
    const { year, month, startIso, endIso, monthIso } = toMonthRange(q.year, q.month);

    const r = await pool.query(
      `
        with hours as (
          select generate_series(0, 23) as h
        ),
        counts as (
          select extract(hour from p.created_at)::int as hour, count(1)::int as cnt
          from photos p
          where p.owner_user_id = $1
            and p.created_at >= $2::timestamptz
            and p.created_at < $3::timestamptz
          group by 1
        )
        select h.h as hour, coalesce(c.cnt, 0)::int as count
        from hours h
        left join counts c on c.hour = h.h
        order by h.h asc
      `,
      [user.id, startIso, endIso],
    );

    const hours = Array.from({ length: 24 }, (_, i) => 0);
    for (const row of r.rows || []) {
      const idx = Number(row.hour);
      if (Number.isFinite(idx) && idx >= 0 && idx <= 23) hours[idx] = Number(row.count) || 0;
    }

    return {
      month: monthIso,
      year,
      monthNumber: month,
      hours,
      total: hours.reduce((a, b) => a + b, 0),
    };
  });

  app.get('/me/analytics/daily-goal', { preHandler: requireMember() }, async (req) => {
    const user = req.authUser;
    await upsertUser(user);
    const today = await pool.query(
      `
        select to_char(now(), 'YYYY-MM-DD') as day,
               (select count(1)::int from photos p
                where p.owner_user_id = $1
                  and p.created_at >= date_trunc('day', now())
                  and p.created_at < date_trunc('day', now()) + interval '1 day') as uploads
      `,
      [user.id],
    );

    const settings = await pool.query('select daily_upload_goal::int as goal from user_settings where user_id=$1', [user.id]);
    const rawGoal = settings.rowCount ? Number(settings.rows?.[0]?.goal ?? 0) : null;
    const goal = rawGoal && rawGoal > 0 ? rawGoal : null;

    return {
      day: String(today.rows?.[0]?.day || ''),
      uploads: Number(today.rows?.[0]?.uploads || 0),
      goal,
    };
  });

  app.post('/me/analytics/daily-goal', {
    preHandler: requireMember(),
    schema: {
      body: {
        type: 'object',
        required: ['goal'],
        properties: {
          goal: { anyOf: [{ type: 'integer', minimum: 0, maximum: 1000 }, { type: 'null' }] },
        },
      },
    },
    handler: async (req) => {
      const user = req.authUser;
      await upsertUser(user);
      const goal = Number(req.body?.goal);
      if (!Number.isFinite(goal) || goal < 0 || goal > 1000) {
        throw badRequest('GOAL_INVALID', '每日目标不合法');
      }

      if (!goal || goal <= 0) {
        await pool.query('delete from user_settings where user_id=$1', [user.id]);
        return { goal: null };
      }

      const r = await pool.query(
        `
          insert into user_settings(user_id, daily_upload_goal)
          values ($1, $2)
          on conflict (user_id) do update set daily_upload_goal = excluded.daily_upload_goal
          returning daily_upload_goal::int as goal
        `,
        [user.id, goal],
      );

      return { goal: Number(r.rows?.[0]?.goal ?? goal) };
    },
  });
};
