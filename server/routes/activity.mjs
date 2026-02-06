import { pool } from '../db.mjs';
import { requireMember } from '../plugins/rbac.mjs';

const localDayIso = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const addDaysIso = (iso, deltaDays) => {
  const [y, m, d] = String(iso).split('-').map((v) => Number(v));
  const base = Date.UTC(y, m - 1, d);
  const next = new Date(base + deltaDays * 86400000);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

export const registerActivityRoutes = async (app) => {
  app.get('/activity/summary', { preHandler: requireMember() }, async (req) => {
    const userId = req.authUser.id;
    const today = localDayIso();

    const rows = await pool.query(
      `
        select day::text as day, uploads_count
        from activity_logs
        where user_id = $1
          and day <= $2::date
          and uploads_count > 0
        order by day desc
      `,
      [userId, today],
    );

    let currentStreak = 0;
    let cursor = today;
    for (const r of rows.rows) {
      const day = String(r.day);
      if (day !== cursor) break;
      currentStreak += 1;
      cursor = addDaysIso(cursor, -1);
    }

    const longest = await pool.query(
      `
        with days as (
          select day
          from activity_logs
          where user_id = $1 and uploads_count > 0
          order by day
        ), grouped as (
          select day,
                 day - (row_number() over (order by day))::int as grp
          from days
        )
        select coalesce(max(cnt), 0)::int as longest
        from (
          select grp, count(*)::int as cnt
          from grouped
          group by grp
        ) x
      `,
      [userId],
    );

    const last = rows.rows.length ? String(rows.rows[0].day) : null;
    const totalActiveDays = rows.rows.length;

    return {
      today,
      currentStreak,
      longestStreak: longest.rows[0]?.longest ?? 0,
      totalActiveDays,
      lastActiveDay: last,
    };
  });

  app.get('/activity/heatmap', { preHandler: requireMember() }, async (req) => {
    const userId = req.authUser.id;
    const year = req.query.year ? parseInt(req.query.year) : null;
    
    let startDate, endDate;
    
    if (year) {
      startDate = `${year}-01-01`;
      endDate = `${year}-12-31`;
    } else {
      const today = localDayIso();
      endDate = today;
      startDate = addDaysIso(today, -365);
    }

    const rows = await pool.query(
      `
        select day::text as day, uploads_count
        from activity_logs
        where user_id = $1
          and day >= $2::date
          and day <= $3::date
        order by day asc
      `,
      [userId, startDate, endDate],
    );

    const heatmap = new Map();
    for (const r of rows.rows) {
      const day = String(r.day);
      heatmap.set(day, Number(r.uploads_count));
    }

    return {
      startDate,
      endDate,
      days: Object.fromEntries(heatmap),
    };
  });
};
