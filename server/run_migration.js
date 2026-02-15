import { loadEnvIfNeeded } from './lib/load_env.mjs';
import { pool } from './db.mjs';

loadEnvIfNeeded();

async function runMigration(filePath, name) {
  process.stdout.write(`\n=== 运行迁移: ${name} ===\n`)
  try {
    const sql = await import('fs').then(fs => fs.readFileSync(filePath, 'utf-8'));
    await pool.query(sql);
    process.stdout.write(`✓ ${name} 完成\n`)
  } catch (err) {
    console.error(`✗ ${name} 失败:`, err.message);
    throw err;
  }
}

async function main() {
  process.stdout.write('开始运行 P6-3 迁移...\n')

  await runMigration('./migrations/008_badges.sql', 'badges 表');
  await runMigration('./migrations/009_challenges.sql', 'challenges 表');

  process.stdout.write('\n=== 初始化徽章数据 ===\n')
  const { seedBadges } = await import('./db/badges.mjs');
  await seedBadges();
  process.stdout.write('✓ 徽章数据初始化完成\n')

  process.stdout.write('\n=== 初始化挑战数据 ===\n')
  const { seedWeeklyChallenges } = await import('./db/challenges.mjs');
  await seedWeeklyChallenges();
  process.stdout.write('✓ 挑战数据初始化完成\n')

  process.stdout.write('\n所有迁移完成！\n')
  await pool.end();
}

main().catch(console.error);
