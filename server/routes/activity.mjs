import { pool } from '../db.mjs';
import { upsertUser } from '../db/users.mjs';
import { badRequest } from '../lib/http_errors.mjs';
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

const parseDateIso = (raw) => {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map((v) => Number(v));
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (!Number.isFinite(dt.getTime())) return null;
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
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
    
    // Check if we have any activity
    if (rows.rows.length > 0) {
      const lastActiveDay = String(rows.rows[0].day);
      const yesterday = addDaysIso(today, -1);
      
      // Streak is valid if last active day is today or yesterday
      // If last active day is before yesterday, streak is broken (0)
      if (lastActiveDay === today || lastActiveDay === yesterday) {
        let cursor = lastActiveDay;
        for (const r of rows.rows) {
          const day = String(r.day);
          if (day !== cursor) break;
          currentStreak += 1;
          cursor = addDaysIso(cursor, -1);
        }
      }
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

  app.get('/me/uploads/timeline', { preHandler: requireMember() }, async (req) => {
    const user = req.authUser;
    await upsertUser(user);

    const q = req.query || {};
    const today = localDayIso();

    const from = parseDateIso(q.from) || addDaysIso(today, -30);
    const to = parseDateIso(q.to) || today;
    if (from > to) throw badRequest('DATE_RANGE_INVALID', '日期范围不合法');

    const dayLimit = Math.max(1, Math.min(60, Number.parseInt(String(q.limitDays ?? 14), 10) || 14));
    const dayOffset = Math.max(0, Number.parseInt(String(q.offsetDays ?? 0), 10) || 0);

    const keyword = String(q.keyword ?? '').trim();
    const hasKeyword = keyword.length > 0;
    const keywordParam = `%${keyword.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;

    const baseWhere = `
      p.owner_user_id = $1
      and p.created_at >= $2::date
      and p.created_at < ($3::date + interval '1 day')
      ${hasKeyword ? `and (p.title ilike $4 or p.description ilike $4 or array_to_string(p.tags, ',') ilike $4)` : ''}
    `;

    const baseParams = hasKeyword ? [user.id, from, to, keywordParam] : [user.id, from, to];
    const paramsWithPaging = [...baseParams, dayLimit, dayOffset];

    const daysSql = `
      with days as (
        select date_trunc('day', p.created_at)::date as day, count(1)::int as count
        from photos p
        where ${baseWhere}
        group by 1
        order by 1 desc
        limit $${baseParams.length + 1} offset $${baseParams.length + 2}
      )
      select
        d.day::text as day,
        d.count,
        coalesce(x.photos, '[]'::json) as photos
      from days d
      left join lateral (
        select json_agg(
          json_build_object(
            'id', p2.id,
            'title', p2.title,
            'thumbUrl', nullif(p2.image_variants->>'thumb', ''),
            'createdAt', p2.created_at
          )
          order by p2.created_at desc
        ) as photos
        from (
          select p2.*
          from photos p2
          where p2.owner_user_id = $1
            and date_trunc('day', p2.created_at)::date = d.day
            and p2.created_at >= $2::date
            and p2.created_at < ($3::date + interval '1 day')
            ${hasKeyword ? `and (p2.title ilike $4 or p2.description ilike $4 or array_to_string(p2.tags, ',') ilike $4)` : ''}
          order by p2.created_at desc
          limit 6
        ) p2
      ) x on true
      order by d.day desc
    `;

    const itemsRes = await pool.query(daysSql, paramsWithPaging);

    const totalDaysSql = `
      select count(*)::int as total
      from (
        select 1
        from photos p
        where ${baseWhere}
        group by date_trunc('day', p.created_at)::date
      ) x
    `;
    const totalRes = await pool.query(totalDaysSql, baseParams);
    const totalDays = Number(totalRes.rows?.[0]?.total || 0);

    return {
      from,
      to,
      keyword,
      limitDays: dayLimit,
      offsetDays: dayOffset,
      totalDays,
      items: (itemsRes.rows || []).map((r) => ({
        day: String(r.day),
        count: Number(r.count || 0),
        photos: r.photos || [],
      })),
    };
  });
};
