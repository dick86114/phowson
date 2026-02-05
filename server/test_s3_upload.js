import { loadEnvIfNeeded } from './lib/load_env.mjs';
import { isObjectStorageEnabled, putPhotoObject, createPhotoObjectKey, createVariantObjectKey } from './lib/object_storage.mjs';
import { generatePhotoVariants } from './lib/image_variants.mjs';
import sharp from 'sharp';

loadEnvIfNeeded();

async function testS3Upload() {
  console.log('=== S3 上传测试 ===\n');

  console.log('1. 检查 S3 配置...');
  const enabled = isObjectStorageEnabled();
  console.log('S3 启用状态:', enabled ? '是' : '否');

  if (!enabled) {
    console.log('错误：S3 未启用，请检查环境变量');
    return;
  }

  console.log('环境变量:');
  console.log('  S3_ENDPOINT:', process.env.S3_ENDPOINT);
  console.log('  S3_BUCKET:', process.env.S3_BUCKET);
  console.log('  S3_PUBLIC_BASE_URL:', process.env.S3_PUBLIC_BASE_URL);
  console.log('  S3_FORCE_PATH_STYLE:', process.env.S3_FORCE_PATH_STYLE);

  console.log('\n2. 生成测试图片...');
  const testImage = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 100, g: 150, b: 200 },
    },
  })
    .png()
    .toBuffer();

  console.log('测试图片大小:', testImage.length, 'bytes');

  console.log('\n3. 测试上传原图...');
  try {
    const photoId = 'test-' + Date.now();
    const key = createPhotoObjectKey({ photoId, mime: 'image/png' });
    console.log('对象 Key:', key);

    const uploaded = await putPhotoObject({ key, buffer: testImage, mime: 'image/png' });
    console.log('上传结果:', uploaded ? '成功' : '失败');
    console.log('URL:', uploaded?.url || 'null');
  } catch (err) {
    console.error('上传失败:', err.message);
    console.error('错误详情:', err.stack);
    return;
  }

  console.log('\n4. 测试生成变体...');
  try {
    const variants = await generatePhotoVariants(testImage);
    console.log('变体生成成功');
    console.log('  Thumb:', variants.thumb?.buffer?.length, 'bytes');
    console.log('  Medium:', variants.medium?.buffer?.length, 'bytes');
  } catch (err) {
    console.error('变体生成失败:', err.message);
    return;
  }

  console.log('\n=== 测试完成 ===');
}

testS3Upload().catch(console.error);
