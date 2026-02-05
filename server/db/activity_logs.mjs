import { pool } from '../db.mjs';

export const bumpUploadActivity = async ({ userId, day }) => {
  const uid = String(userId || '').trim();
  const d = String(day || '').trim();
  if (!uid || !d) return;
  await pool.query(
    `
      insert into activity_logs(day, user_id, uploads_count)
      values ($1, $2, 1)
      on conflict (day, user_id) do update set
        uploads_count = activity_logs.uploads_count + 1
    `,
    [d, uid],
  );
};

