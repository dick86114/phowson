import { pool } from '../db.mjs';

export const getAllBadges = async () => {
  const r = await pool.query(
    'select * from badges where is_active = true order by sort_order asc',
  );
  return r.rows;
};

export const getBadgeById = async (id) => {
  const r = await pool.query('select * from badges where id = $1', [id]);
  return r.rows[0] || null;
};

export const getUserBadges = async (userId) => {
  const r = await pool.query(
    `
      select b.*, ub.earned_at
      from badges b
      inner join user_badges ub on b.id = ub.badge_id
      where ub.user_id = $1
      order by ub.earned_at desc
    `,
    [userId],
  );
  return r.rows;
};

export const awardBadge = async (userId, badgeId) => {
  const id = crypto.randomUUID();
  await pool.query(
    `
      insert into user_badges(id, user_id, badge_id, earned_at)
      values ($1, $2, $3, now())
      on conflict (user_id, badge_id) do nothing
    `,
    [id, userId, badgeId],
  );
  return id;
};

export const checkAndAwardBadges = async (userId) => {
  const badges = await getAllBadges();
  const userBadges = await getUserBadges(userId);
  const earnedBadgeIds = new Set(userBadges.map((b) => b.id));

  const newlyEarned = [];

  for (const badge of badges) {
    if (earnedBadgeIds.has(badge.id)) continue;

    const earned = await evaluateBadgeCondition(userId, badge);
    if (earned) {
      await awardBadge(userId, badge.id);
      newlyEarned.push(badge);
    }
  }

  return newlyEarned;
};

const evaluateBadgeCondition = async (userId, badge) => {
  const { condition_type, condition_config } = badge;

  switch (condition_type) {
    case 'total_photos': {
      const r = await pool.query(
        'select count(*)::int as cnt from photos where owner_user_id = $1',
        [userId],
      );
      return r.rows[0].cnt >= condition_config.min_photos;
    }

    case 'streak_days': {
      const r = await pool.query(
        `
          with days as (
            select day::date
            from activity_logs
            where user_id = $1 and uploads_count > 0
            order by day desc
          ), grouped as (
            select day,
                   day - (row_number() over (order by day))::int as grp
            from days
          )
          select count(*)::int as max_streak
          from (
            select grp, count(*)::int as cnt
            from grouped
            group by grp
            order by cnt desc
            limit 1
          ) x
        `,
        [userId],
      );
      return r.rows[0].max_streak >= condition_config.min_streak_days;
    }

    case 'consecutive_days': {
      const today = new Date().toISOString().slice(0, 10);
      const r = await pool.query(
        `
          with days as (
            select day::date
            from activity_logs
            where user_id = $1
              and day <= $2::date
              and uploads_count > 0
            order by day desc
          )
          select count(*)::int as current_streak
          from days
          where day = $2::date - (row_number() over (order by day desc) - 1)::int
        `,
        [userId, today],
      );
      return r.rows[0].current_streak >= condition_config.min_consecutive_days;
    }

    case 'category_count': {
      const r = await pool.query(
        `
          select count(distinct category)::int as cnt
          from photos
          where owner_user_id = $1
        `,
        [userId],
      );
      return r.rows[0].cnt >= condition_config.min_categories;
    }

    case 'likes_received': {
      const r = await pool.query(
        `
          select coalesce(sum(likes_count), 0)::int as total_likes
          from photos
          where owner_user_id = $1
        `,
        [userId],
      );
      return r.rows[0].total_likes >= condition_config.min_likes;
    }

    case 'photos_in_category': {
      const r = await pool.query(
        `
          select count(*)::int as cnt
          from photos
          where owner_user_id = $1 and category = $2
        `,
        [userId, condition_config.category],
      );
      return r.rows[0].cnt >= condition_config.min_photos;
    }

    default:
      return false;
  }
};

export const seedBadges = async () => {
  const badges = [
    {
      id: 'badge-first-photo',
      name: '初次亮相',
      description: '上传第一张照片',
      icon: 'camera',
      icon_color: '#3b82f6',
      condition_type: 'total_photos',
      condition_config: { min_photos: 1 },
      xp_reward: 10,
      sort_order: 1,
    },
    {
      id: 'badge-ten-photos',
      name: '摄影新手',
      description: '上传 10 张照片',
      icon: 'image',
      icon_color: '#10b981',
      condition_type: 'total_photos',
      condition_config: { min_photos: 10 },
      xp_reward: 50,
      sort_order: 2,
    },
    {
      id: 'badge-hundred-photos',
      name: '摄影达人',
      description: '上传 100 张照片',
      icon: 'aperture',
      icon_color: '#8b5cf6',
      condition_type: 'total_photos',
      condition_config: { min_photos: 100 },
      xp_reward: 200,
      sort_order: 3,
    },
    {
      id: 'badge-streak-7',
      name: '坚持一周',
      description: '连续 7 天上传照片',
      icon: 'flame',
      icon_color: '#f59e0b',
      condition_type: 'consecutive_days',
      condition_config: { min_consecutive_days: 7 },
      xp_reward: 100,
      sort_order: 10,
    },
    {
      id: 'badge-streak-30',
      name: '坚持不懈',
      description: '连续 30 天上传照片',
      icon: 'zap',
      icon_color: '#ef4444',
      condition_type: 'consecutive_days',
      condition_config: { min_consecutive_days: 30 },
      xp_reward: 500,
      sort_order: 11,
    },
    {
      id: 'badge-landscape',
      name: '风景爱好者',
      description: '上传 20 张风景照片',
      icon: 'mountain',
      icon_color: '#06b6d4',
      condition_type: 'photos_in_category',
      condition_config: { category: 'landscape', min_photos: 20 },
      xp_reward: 100,
      sort_order: 20,
    },
    {
      id: 'badge-portrait',
      name: '人像大师',
      description: '上传 20 张人像照片',
      icon: 'user',
      icon_color: '#ec4899',
      condition_type: 'photos_in_category',
      condition_config: { category: 'portrait', min_photos: 20 },
      xp_reward: 100,
      sort_order: 21,
    },
    {
      id: 'badge-explorer',
      name: '探索者',
      description: '在 5 个不同分类上传照片',
      icon: 'compass',
      icon_color: '#14b8a6',
      condition_type: 'category_count',
      condition_config: { min_categories: 5 },
      xp_reward: 150,
      sort_order: 30,
    },
    {
      id: 'badge-liked',
      name: '人气摄影师',
      description: '累计获得 100 次点赞',
      icon: 'heart',
      icon_color: '#f43f5e',
      condition_type: 'likes_received',
      condition_config: { min_likes: 100 },
      xp_reward: 200,
      sort_order: 40,
    },
  ];

  for (const badge of badges) {
    await pool.query(
      `
        insert into badges(id, name, description, icon, icon_color, condition_type, condition_config, xp_reward, sort_order)
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        on conflict (id) do update set
          name = excluded.name,
          description = excluded.description,
          icon = excluded.icon,
          icon_color = excluded.icon_color,
          condition_type = excluded.condition_type,
          condition_config = excluded.condition_config,
          xp_reward = excluded.xp_reward,
          sort_order = excluded.sort_order
      `,
      [
        badge.id,
        badge.name,
        badge.description,
        badge.icon,
        badge.icon_color,
        badge.condition_type,
        JSON.stringify(badge.condition_config),
        badge.xp_reward,
        badge.sort_order,
      ],
    );
  }
};
