import { pool } from '../db.mjs';

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
};
