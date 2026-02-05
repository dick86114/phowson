import { loadEnvIfNeeded } from './lib/load_env.mjs';
import { pool } from './db.mjs';

loadEnvIfNeeded();

async function diagnoseUpload() {
  console.log('=== 上传功能诊断 ===\n');

  console.log('1. 检查环境变量...');
  const envVars = {
    DATABASE_URL: process.env.DATABASE_URL ? '已设置' : '未设置',
    S3_ENDPOINT: process.env.S3_ENDPOINT || '未设置',
    S3_BUCKET: process.env.S3_BUCKET || '未设置',
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ? '已设置' : '未设置',
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ? '已设置' : '未设置',
    UPLOAD_MAX_BYTES: process.env.UPLOAD_MAX_BYTES || '25MB (默认)',
  };
  console.table(envVars);

  console.log('\n2. 检查数据库连接...');
  try {
    await pool.query('SELECT 1');
    console.log('✓ 数据库连接正常');
  } catch (err) {
    console.error('✗ 数据库连接失败:', err.message);
    return;
  }

  console.log('\n3. 检查 photos 表结构...');
  try {
    const columns = await pool.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'photos'
      ORDER BY ordinal_position
    `);
    console.table(columns.rows);
  } catch (err) {
    console.error('✗ 查询失败:', err.message);
  }

  console.log('\n4. 检查最近的照片记录...');
  try {
    const recent = await pool.query(`
      SELECT id, title, LENGTH(image_bytes) as bytes_size, image_url, created_at
      FROM photos
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.table(recent.rows);
  } catch (err) {
    console.error('✗ 查询失败:', err.message);
  }

  console.log('\n5. 测试 S3 连接...');
  const S3_ENABLED = process.env.S3_ENDPOINT && process.env.S3_BUCKET &&
                    process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY;
  console.log('S3 启用状态:', S3_ENABLED ? '是' : '否');
  
  if (S3_ENABLED) {
    try {
      const { S3Client, ListBucketsCommand } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'auto',
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
      });
      
      const buckets = await s3.send(new ListBucketsCommand({}));
      console.log('✓ S3 连接正常，存储桶列表:', buckets.Buckets?.map(b => b.Name));
    } catch (err) {
      console.error('✗ S3 连接失败:', err.message);
    }
  }

  console.log('\n6. 检查活动日志表...');
  try {
    const activity = await pool.query(`
      SELECT day, user_id, uploads_count
      FROM activity_logs
      ORDER BY day DESC
      LIMIT 5
    `);
    console.table(activity.rows);
  } catch (err) {
    console.error('✗ 查询失败:', err.message);
  }

  console.log('\n7. 测试登录接口...');
  try {
    const email = process.env.ADMIN_EMAIL || 'admin@phowson.com';
    const password = process.env.ADMIN_PASSWORD || '';

    if (!password) {
      console.log('⚠ ADMIN_PASSWORD 未设置，跳过登录测试');
    } else {
      const loginRes = await fetch('http://localhost:3001/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginRes.json();
      console.log('登录状态:', loginRes.status);
      console.log('返回数据:', JSON.stringify({
        hasToken: !!loginData.token,
        userId: loginData.user?.id,
        userRole: loginData.user?.role,
      }, null, 2));
    }
  } catch (err) {
    console.error('✗ 登录测试失败:', err.message);
  }

  console.log('\n=== 诊断完成 ===');
  await pool.end();
}

diagnoseUpload().catch(console.error);
