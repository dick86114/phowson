import { pool } from '../db.mjs';
import { getPhotoImage } from '../lib/photo_image.mjs';
import exifr from 'exifr';
import { normalizeExif } from '../lib/exif.mjs';

async function fixGpsData() {
  const out = (s) => process.stdout.write(`${s}\n`)
  const warn = (s) => process.stderr.write(`${s}\n`)

  out('开始扫描数据库中的照片...')
  
  // 只查找没有 GPS 信息但有图片数据的照片
  const r = await pool.query('SELECT id, title, exif, image_url, image_bytes FROM photos WHERE lat IS NULL OR lng IS NULL');
  
  out(`找到 ${r.rowCount} 张可能需要修复的照片。`)
  
  let fixedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const row of r.rows) {
    try {
      out(`正在处理 [${row.id}] ${row.title}...`)
      
      const { buffer } = await getPhotoImage(row.id);
      if (!buffer || buffer.length === 0) {
        warn(`  - 无法获取图片数据，跳过。`)
        skippedCount++;
        continue;
      }

      const exifData = await exifr.parse(buffer);
      if (exifData && typeof exifData.latitude === 'number' && typeof exifData.longitude === 'number') {
        const lat = exifData.latitude;
        const lng = exifData.longitude;
        
        // 更新 exif JSON 中的数据
        const currentExif = typeof row.exif === 'string' ? JSON.parse(row.exif) : (row.exif || {});
        const updatedExif = {
          ...currentExif,
          lat,
          lng
        };

        await pool.query(
          'UPDATE photos SET lat = $1, lng = $2, exif = $3 WHERE id = $4',
          [lat, lng, JSON.stringify(updatedExif), row.id]
        );
        
        out(`  - 成功提取 GPS: ${lat}, ${lng}`)
        fixedCount++;
      } else {
        out('  - 图片中未找到 GPS 信息。')
        skippedCount++;
      }
    } catch (err) {
      console.error(`  - 处理失败: ${err.message}`);
      failedCount++;
    }
  }

  out('\n修复完成！')
  out(`- 成功修复: ${fixedCount}`)
  out(`- 无需修复/跳过: ${skippedCount}`)
  out(`- 修复失败: ${failedCount}`)
  
  process.exit(0);
}

fixGpsData().catch(err => {
  console.error('脚本运行出错:', err);
  process.exit(1);
});
