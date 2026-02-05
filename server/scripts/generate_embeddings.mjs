#!/usr/bin/env node
/**
 * 批量生成照片 embedding 的脚本
 * 用于为现有照片生成向量表示
 * 
 * 使用方法：
 * node server/scripts/generate_embeddings.mjs [--all | --missing | --ids=id1,id2,id3]
 */

import '../lib/load_env.mjs';
import { pool } from '../db.mjs';
import { generateEmbedding, buildSemanticText } from '../lib/embedding.mjs';

const args = process.argv.slice(2);
const mode = args[0] || '--missing';

async function main() {
  console.log('=== 开始批量生成 Embedding ===\n');

  let photos = [];

  if (mode === '--all') {
    // 生成所有照片的 embedding
    console.log('模式：为所有照片重新生成 embedding');
    const result = await pool.query('SELECT * FROM photos ORDER BY created_at DESC');
    photos = result.rows;
  } else if (mode === '--missing') {
    // 只生成缺失 embedding 的照片
    console.log('模式：只为缺失 embedding 的照片生成');
    const result = await pool.query('SELECT * FROM photos WHERE embedding IS NULL ORDER BY created_at DESC');
    photos = result.rows;
  } else if (mode.startsWith('--ids=')) {
    // 为指定 ID 的照片生成 embedding
    const ids = mode.replace('--ids=', '').split(',');
    console.log(`模式：为指定照片生成 [${ids.join(', ')}]`);
    const result = await pool.query('SELECT * FROM photos WHERE id = ANY($1)', [ids]);
    photos = result.rows;
  } else {
    console.error('错误：未知模式');
    console.log('使用方法：');
    console.log('  node server/scripts/generate_embeddings.mjs --all       # 为所有照片重新生成');
    console.log('  node server/scripts/generate_embeddings.mjs --missing   # 只为缺失的照片生成');
    console.log('  node server/scripts/generate_embeddings.mjs --ids=id1,id2,id3');
    process.exit(1);
  }

  console.log(`找到 ${photos.length} 张照片需要处理\n`);

  if (photos.length === 0) {
    console.log('✅ 没有需要处理的照片');
    process.exit(0);
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const progress = `[${i + 1}/${photos.length}]`;

    try {
      // 构建语义文本
      const text = buildSemanticText(photo);
      
      if (!text || text.trim().length === 0) {
        console.log(`${progress} ⚠️  跳过 ${photo.id} - ${photo.title}（无内容）`);
        continue;
      }

      // 生成 embedding
      const embedding = await generateEmbedding(text);

      // 保存到数据库
      await pool.query(
        'UPDATE photos SET embedding = $1 WHERE id = $2',
        [JSON.stringify(embedding), photo.id]
      );

      successCount++;
      console.log(`${progress} ✅ ${photo.id} - ${photo.title}`);

      // 添加延迟避免 API 速率限制
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      failCount++;
      console.error(`${progress} ❌ ${photo.id} - ${photo.title}: ${error.message}`);
    }
  }

  console.log(`\n=== 完成 ===`);
  console.log(`成功: ${successCount} 张`);
  console.log(`失败: ${failCount} 张`);
  console.log(`总计: ${photos.length} 张`);

  await pool.end();
}

main().catch((error) => {
  console.error('脚本执行失败:', error);
  process.exit(1);
});
