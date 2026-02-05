import { pool } from '../db.mjs';

export const getActiveChallenges = async () => {
  const today = new Date().toISOString().slice(0, 10);
  const r = await pool.query(
    `
      select * from challenges
      where is_active = true
        and start_date <= $1::date
        and end_date >= $1::date
      order by end_date asc
    `,
    [today],
  );
  return r.rows;
};

export const getChallengeById = async (id) => {
  const r = await pool.query('select * from challenges where id = $1', [id]);
  return r.rows[0] || null;
};

export const getUserChallenges = async (userId) => {
  const r = await pool.query(
    `
      select c.*, uc.joined_at, uc.completed_at
      from challenges c
      inner join user_challenges uc on c.id = uc.challenge_id
      where uc.user_id = $1
      order by uc.joined_at desc
    `,
    [userId],
  );
  return r.rows;
};

export const joinChallenge = async (userId, challengeId) => {
  const id = crypto.randomUUID();
  await pool.query(
    `
      insert into user_challenges(id, user_id, challenge_id, joined_at)
      values ($1, $2, $3, now())
      on conflict (user_id, challenge_id) do nothing
    `,
    [id, userId, challengeId],
  );
  return id;
};

export const getChallengeProgress = async (userId, challengeId) => {
  const r = await pool.query(
    `
      select * from challenge_progress
      where user_id = $1 and challenge_id = $2
    `,
    [userId, challengeId],
  );
  return r.rows;
};

export const updateChallengeProgress = async (userId, challengeId, progressType, currentValue, targetValue) => {
  const id = crypto.randomUUID();
  await pool.query(
    `
      insert into challenge_progress(id, user_id, challenge_id, progress_type, current_value, target_value, updated_at)
      values ($1, $2, $3, $4, $5, $6, now())
      on conflict (user_id, challenge_id, progress_type) do update set
        current_value = excluded.current_value,
        target_value = excluded.target_value,
        updated_at = now()
    `,
    [id, userId, challengeId, progressType, currentValue, targetValue],
  );
  return id;
};

export const completeChallenge = async (userId, challengeId) => {
  await pool.query(
    `
      update user_challenges
      set completed_at = now()
      where user_id = $1 and challenge_id = $2
    `,
    [userId, challengeId],
  );
};

export const checkChallengeCompletion = async (userId, challengeId) => {
  const challenge = await getChallengeById(challengeId);
  if (!challenge || !challenge.is_active) return { completed: false, xpReward: 0 };

  const progress = await getChallengeProgress(userId, challengeId);
  const allCompleted = progress.every((p) => p.current_value >= p.target_value);

  if (allCompleted) {
    await completeChallenge(userId, challengeId);
    return { completed: true, xpReward: challenge.xp_reward };
  }

  return { completed: false, xpReward: 0 };
};

export const seedWeeklyChallenges = async () => {
  const weekStart = getWeekStart(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const challenges = [
    {
      id: `challenge-${weekStart.toISOString().slice(0, 10)}-1`,
      title: '每周挑战：风景大片',
      description: '本周上传 5 张风景照片',
      challenge_type: 'upload_category',
      config: { category: 'landscape', min_photos: 5 },
      xp_reward: 100,
      start_date: weekStart.toISOString().slice(0, 10),
      end_date: weekEnd.toISOString().slice(0, 10),
    },
    {
      id: `challenge-${weekStart.toISOString().slice(0, 10)}-2`,
      title: '每日一拍',
      description: '本周连续 7 天每天至少上传 1 张照片',
      challenge_type: 'daily_upload',
      config: { min_days: 7 },
      xp_reward: 150,
      start_date: weekStart.toISOString().slice(0, 10),
      end_date: weekEnd.toISOString().slice(0, 10),
    },
    {
      id: `challenge-${weekStart.toISOString().slice(0, 10)}-3`,
      title: '人像练习',
      description: '本周上传 3 张人像照片',
      challenge_type: 'upload_category',
      config: { category: 'portrait', min_photos: 3 },
      xp_reward: 75,
      start_date: weekStart.toISOString().slice(0, 10),
      end_date: weekEnd.toISOString().slice(0, 10),
    },
  ];

  for (const challenge of challenges) {
    await pool.query(
      `
        insert into challenges(id, title, description, challenge_type, config, start_date, end_date, xp_reward)
        values ($1, $2, $3, $4, $5, $6, $7, $8)
        on conflict (id) do update set
          title = excluded.title,
          description = excluded.description,
          challenge_type = excluded.challenge_type,
          config = excluded.config,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          xp_reward = excluded.xp_reward
      `,
      [
        challenge.id,
        challenge.title,
        challenge.description,
        challenge.challenge_type,
        JSON.stringify(challenge.config),
        challenge.start_date,
        challenge.end_date,
        challenge.xp_reward,
      ],
    );
  }
};

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
