import { pool } from '../db.mjs';

export const upsertUser = async (user) => {
  if (!user?.id) return;
  const avatarUrl = user.avatar ? user.avatar : null;
  await pool.query(
    `
      insert into users(id, name, role, avatar_url)
      values ($1, $2, $3, $4)
      on conflict (id) do update set
        name = excluded.name,
        role = excluded.role,
        avatar_url = coalesce(users.avatar_url, excluded.avatar_url)
    `,
    [user.id, user.name, user.role, avatarUrl],
  );
};
