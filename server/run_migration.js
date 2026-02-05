import { loadEnvIfNeeded } from './lib/load_env.mjs';
import { pool } from './db.mjs';

loadEnvIfNeeded();

async function runMigration(filePath, name) {
  console.log(`\n=== 运行迁移: ${name} ===`);
  try {
    const sql = await import('fs').then(fs => fs.readFileSync(filePath, 'utf-8'));
    await pool.query(sql);
    console.log(`✓ ${name} 完成`);
  } catch (err) {
    console.error(`✗ ${name} 失败:`, err.message);
    throw err;
  }
}

async function main() {
  console.log('开始运行 P6-3 迁移...');

  await runMigration('./migrations/008_badges.sql', 'badges 表');
  await runMigration('./migrations/009_challenges.sql', 'challenges 表');

  console.log('\n=== 初始化徽章数据 ===');
  const { seedBadges } = await import('./db/badges.mjs');
  await seedBadges();
  console.log('✓ 徽章数据初始化完成');

  console.log('\n=== 初始化挑战数据 ===');
  const { seedWeeklyChallenges } = await import('./db/challenges.mjs');
  await seedWeeklyChallenges();
  console.log('✓ 挑战数据初始化完成');

  console.log('\n所有迁移完成！');
  await pool.end();
}

main().catch(console.error);
