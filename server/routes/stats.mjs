import { pool } from '../db.mjs';
import { badRequest } from '../lib/http_errors.mjs';
import { requireMember, requireAdmin } from '../plugins/rbac.mjs';
import { upsertUser } from '../db/users.mjs';
import os from 'node:os';

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
  app.get('/stats/platform', { preHandler: requireAdmin() }, async () => {
    const totalRes = await pool.query('select count(*)::int as c from users');
    const totalUsers = totalRes.rows[0].c;

    const activeRes = await pool.query("select count(*)::int as c from users where last_login_at > now() - interval '24 hours'");
    const activeToday = activeRes.rows[0].c;

    const load = os.loadavg();
    const systemLoad = Math.round(load[0] * 100) / 100;

    return {
        totalUsers,
        activeToday,
        systemLoad
    };
  });

  app.get('/stats/summary', async (req) => {
    const { days = 30 } = req.query;
    const daysNum = parseInt(days) || 30;

    // 1. 基础汇总 (Summary Cards)
    // Dynamic Trend Calculation based on 'days' parameter
    const summary = await pool.query(`
      WITH params AS (
        SELECT $1::int as days
      ),
      dates AS (
        SELECT 
          NOW() as curr_end,
          NOW() - (p.days::text || ' days')::interval as curr_start,
          NOW() - (p.days::text || ' days')::interval as prev_end,
          NOW() - ((2 * p.days)::text || ' days')::interval as prev_start
        FROM params p
      ),
      -- 1. Total Counts (Snapshots)
      totals AS (
        SELECT 
          (SELECT COUNT(*) FROM photos where is_public = true) as total_photos,
          (SELECT COUNT(*) FROM users) as total_users
      ),
      -- 2. Period New Counts (For "Total" Trends: Momentum)
      period_counts AS (
        SELECT 
          (SELECT COUNT(*) FROM users WHERE created_at >= (select curr_start from dates) AND created_at < (select curr_end from dates)) as users_new_curr,
          (SELECT COUNT(*) FROM users WHERE created_at >= (select prev_start from dates) AND created_at < (select prev_end from dates)) as users_new_prev,
          (SELECT COUNT(*) FROM photos WHERE is_public = true AND created_at >= (select curr_start from dates) AND created_at < (select curr_end from dates)) as photos_new_curr,
          (SELECT COUNT(*) FROM photos WHERE is_public = true AND created_at >= (select prev_start from dates) AND created_at < (select prev_end from dates)) as photos_new_prev
      ),
      -- 3. DAU (Current Snapshot & Period Averages)
      dau_calc AS (
        SELECT 
          -- Current Snapshot (Last 24h)
          (SELECT COUNT(DISTINCT owner_user_id) FROM photos WHERE is_public = true AND created_at > NOW() - INTERVAL '24 hours') as dau_now,
          
          -- Avg DAU Current Period
          (
            SELECT COALESCE(AVG(daily_cnt), 0)
            FROM (
              SELECT COUNT(DISTINCT owner_user_id) as daily_cnt 
              FROM photos 
              WHERE is_public = true AND created_at >= (select curr_start from dates) AND created_at < (select curr_end from dates)
              GROUP BY date_trunc('day', created_at)
            ) t1
          ) as dau_avg_curr,
          
          -- Avg DAU Previous Period
          (
            SELECT COALESCE(AVG(daily_cnt), 0)
            FROM (
              SELECT COUNT(DISTINCT owner_user_id) as daily_cnt 
              FROM photos 
              WHERE is_public = true AND created_at >= (select prev_start from dates) AND created_at < (select prev_end from dates)
              GROUP BY date_trunc('day', created_at)
            ) t2
          ) as dau_avg_prev
      ),
      -- 4. Growth Rate (Snapshot at Now vs Snapshot at Prev_End)
      growth_rates AS (
        -- Rate Now (Last 7 days from Now)
        SELECT 
          (
            SELECT CASE WHEN base = 0 THEN 0 ELSE (added::float / base) * 100 END
            FROM (
              SELECT 
                (SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days') as added,
                (SELECT COUNT(*) FROM users WHERE created_at <= NOW() - INTERVAL '7 days') as base
            ) t
          ) as rate_now,
          
          -- Rate Prev (Last 7 days from Prev_End / Curr_Start)
          (
            SELECT CASE WHEN base = 0 THEN 0 ELSE (added::float / base) * 100 END
            FROM (
              SELECT 
                (SELECT COUNT(*) FROM users WHERE created_at > (select curr_start from dates) - INTERVAL '7 days' AND created_at <= (select curr_start from dates)) as added,
                (SELECT COUNT(*) FROM users WHERE created_at <= (select curr_start from dates) - INTERVAL '7 days') as base
            ) t
          ) as rate_prev
      )
      SELECT 
        t.total_photos::int,
        t.total_users::int,
        d.dau_now::int as dau,
        g.rate_now as avg_weekly_growth,
        
        -- Trends (Percentage Change)
        -- Users Trend (Momentum: New Users Comparison)
        CASE WHEN pc.users_new_prev = 0 THEN 
             CASE WHEN pc.users_new_curr > 0 THEN 100 ELSE 0 END
             ELSE ROUND(((pc.users_new_curr - pc.users_new_prev)::numeric / pc.users_new_prev::numeric) * 100, 1)
        END::float as users_trend,
        
        -- Photos Trend (Momentum: New Photos Comparison)
        CASE WHEN pc.photos_new_prev = 0 THEN 
             CASE WHEN pc.photos_new_curr > 0 THEN 100 ELSE 0 END
             ELSE ROUND(((pc.photos_new_curr - pc.photos_new_prev)::numeric / pc.photos_new_prev::numeric) * 100, 1)
        END::float as photos_trend,
        
        -- DAU Trend (Avg vs Avg)
        CASE WHEN d.dau_avg_prev = 0 THEN 
             CASE WHEN d.dau_avg_curr > 0 THEN 100 ELSE 0 END
             ELSE ROUND(((d.dau_avg_curr - d.dau_avg_prev)::numeric / d.dau_avg_prev::numeric) * 100, 1)
        END::float as dau_trend,
        
        -- Growth Rate Trend (Rate vs Rate)
        CASE WHEN g.rate_prev = 0 THEN 
             CASE WHEN g.rate_now > 0 THEN 100 ELSE 0 END
             ELSE ROUND(((g.rate_now - g.rate_prev)::numeric / g.rate_prev::numeric) * 100, 1)
        END::float as growth_rate_trend
        
      FROM totals t, period_counts pc, dau_calc d, growth_rates g
    `, [daysNum]);

    // 2. 分类分布 (Category Distribution) - 当前周期
    const dist = await pool.query(`
      SELECT category, COUNT(*)::int as count
      FROM photos
      WHERE is_public = true AND created_at > NOW() - INTERVAL '${daysNum} days'
      GROUP BY category
      ORDER BY count DESC
    `);

    // 3. 上传趋势 (Upload Trends) - This Period vs Last Period
    const trendCurrent = await pool.query(`
      SELECT 
        TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') as date,
        COUNT(*)::int as count
      FROM photos
      WHERE is_public = true AND created_at > NOW() - INTERVAL '${daysNum} days'
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    const trendPrevious = await pool.query(`
      SELECT 
        TO_CHAR(date_trunc('day', created_at) + INTERVAL '${daysNum} days', 'YYYY-MM-DD') as date,
        COUNT(*)::int as count
      FROM photos
      WHERE is_public = true AND created_at <= NOW() - INTERVAL '${daysNum} days'
        AND created_at > NOW() - INTERVAL '${daysNum * 2} days'
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    // Merge trends
    const trendMap = new Map();
    // Initialize map with all dates in range to ensure continuity (optional, but good for charts)
    // For simplicity, we just merge the query results.
    trendCurrent.rows.forEach(r => {
        trendMap.set(r.date, { date: r.date, current: r.count, previous: 0 });
    });
    trendPrevious.rows.forEach(r => {
        if (trendMap.has(r.date)) {
            trendMap.get(r.date).previous = r.count;
        } else {
             // If current period has no data for this day, we still might want to record previous? 
             // Ideally we want to show the 'current' date axis.
             // If a date exists in previous (shifted) but not current, it means we align by relative day.
             // But simpler is to only show dates that exist in 'current' or fill gaps.
             // For now, let's just stick to dates present in current or previous if within range.
             // Actually, simplest is to use current range dates.
             trendMap.set(r.date, { date: r.date, current: 0, previous: r.count });
        }
    });
    
    const uploadTrend = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // 4. 全站热力图 (Global Heatmap) - Last 365 Days
    const heatmap = await pool.query(`
      SELECT 
        TO_CHAR(date_trunc('day', created_at), 'YYYY-MM-DD') as date,
        COUNT(*)::int as count
      FROM photos
      WHERE created_at > NOW() - INTERVAL '1 year'
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return {
      summary: summary.rows[0],
      categoryDistribution: dist.rows,
      uploadTrend,
      heatmap: heatmap.rows,
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
