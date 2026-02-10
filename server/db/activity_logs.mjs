import { pool } from '../db.mjs';

export const bumpUploadActivity = async ({ userId, day }) => {
  const uid = String(userId || '').trim();
  const d = String(day || '').trim();
  if (!uid || !d) return 0;
  const r = await pool.query(
    `
      insert into activity_logs(day, user_id, uploads_count)
      values ($1, $2, 1)
      on conflict (day, user_id) do update set
        uploads_count = activity_logs.uploads_count + 1
      returning uploads_count
    `,
    [d, uid],
  );
  return r.rows[0]?.uploads_count || 0;
};

