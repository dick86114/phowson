import { S3Client, PutBucketPolicyCommand, GetBucketPolicyCommand } from '@aws-sdk/client-s3';
import { loadEnvIfNeeded } from './lib/load_env.mjs';

loadEnvIfNeeded();

const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_BUCKET = process.env.S3_BUCKET;

if (!S3_ENDPOINT || !S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY || !S3_BUCKET) {
  console.error('缺少 S3 环境变量');
  console.error('S3_ENDPOINT:', S3_ENDPOINT);
  console.error('S3_ACCESS_KEY_ID:', S3_ACCESS_KEY_ID ? '***' : 'missing');
  console.error('S3_SECRET_ACCESS_KEY:', S3_SECRET_ACCESS_KEY ? '***' : 'missing');
  console.error('S3_BUCKET:', S3_BUCKET);
  process.exit(1);
}

const s3 = new S3Client({
  endpoint: S3_ENDPOINT,
  region: process.env.S3_REGION || 'auto',
  forcePathStyle: true,
  credentials: {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
  },
});

const publicReadPolicy = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'PublicReadGetObject',
      Effect: 'Allow',
      Principal: '*',
      Action: 's3:GetObject',
      Resource: `arn:aws:s3:::${S3_BUCKET}/*`,
    },
  ],
};

async function setPublicPolicy() {
  try {
    const existing = await s3.send(new GetBucketPolicyCommand({ Bucket: S3_BUCKET }));
    process.stdout.write(`现有存储桶策略: ${JSON.stringify(JSON.parse(existing.Policy || '{}'), null, 2)}\n`)
  } catch (e) {
    process.stdout.write('存储桶暂无策略\n')
  }

  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: S3_BUCKET,
      Policy: JSON.stringify(publicReadPolicy),
    }),
  );

  process.stdout.write('已设置存储桶为公开读取模式\n')
}

setPublicPolicy().catch(console.error);
