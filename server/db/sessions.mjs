import { pool } from '../db.mjs';

export const findSessionUserByTokenHash = async (tokenHash) => {
  const r = await pool.query(
    `
      select
        u.id,
        u.name,
        u.role,
        r.permissions,
        coalesce(u.avatar_url, '/media/avatars/' || u.id) as avatar
      from sessions s
      join users u on u.id = s.user_id
      left join roles r on r.id = u.role
      where s.token_hash = $1 and s.expires_at > now() and u.disabled_at is null
    `,
    [tokenHash],
  );
  return r.rowCount ? r.rows[0] : null;
};

export const createSession = async (tokenHash, userId, ttlDays) => {
  const days = Number(ttlDays);
  const effectiveDays = Number.isFinite(days) && days > 0 ? days : 30;
  await pool.query(
    `
      insert into sessions(token_hash, user_id, expires_at)
      values ($1, $2, now() + ($3 || ' days')::interval)
    `,
    [tokenHash, userId, String(effectiveDays)],
  );
};

export const deleteSession = async (tokenHash) => {
  await pool.query('delete from sessions where token_hash=$1', [tokenHash]);
};

export const deleteSessionsByUserId = async (userId) => {
  await pool.query('delete from sessions where user_id=$1', [String(userId)]);
};

export const cleanupExpiredSessions = async () => {
  await pool.query('delete from sessions where expires_at <= now()');
};
