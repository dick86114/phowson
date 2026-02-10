import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'node:crypto';

const requiredEnv = ['S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_BUCKET', 'S3_PUBLIC_BASE_URL'];

const hasAll = (keys) => keys.every((k) => String(process.env[k] || '').trim());

const toBase = (raw) => String(raw || '').trim().replace(/\/+$/, '');

const joinUrl = (base, path) => {
  const b = toBase(base);
  const p = String(path || '').replace(/^\/+/, '');
  return `${b}/${p}`;
};

const keyFromPublicUrl = (url) => {
  const publicBase = toBase(process.env.S3_PUBLIC_BASE_URL);
  const u = String(url || '').trim();
  if (!publicBase || !u) return null;
  if (!u.startsWith(publicBase + '/')) return null;
  return u.slice(publicBase.length + 1);
};

const toBufferFromBody = async (body) => {
  if (!body) return Buffer.alloc(0);
  if (typeof body.transformToByteArray === 'function') {
    const arr = await body.transformToByteArray();
    return Buffer.from(arr);
  }
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
};

export const isObjectStorageEnabled = () => {
  return hasAll(requiredEnv);
};

export const getS3Client = () => {
  if (!isObjectStorageEnabled()) return null;
  const region = String(process.env.S3_REGION || 'auto');
  const endpoint = String(process.env.S3_ENDPOINT || '').trim() || undefined;
  const forcePathStyle = String(process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true';

  return new S3Client({
    region,
    endpoint,
    forcePathStyle,
    credentials: {
      accessKeyId: String(process.env.S3_ACCESS_KEY_ID),
      secretAccessKey: String(process.env.S3_SECRET_ACCESS_KEY),
    },
  });
};

const extFromMime = (mime) => {
  const m = String(mime || '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/avif') return 'avif';
  return 'bin';
};

export const createPhotoObjectKey = ({ photoId, mime }) => {
  const ext = extFromMime(mime);
  const nonce = crypto.randomBytes(6).toString('hex');
  return `photos/${photoId}/original-${nonce}.${ext}`;
};

export const createVariantObjectKey = ({ photoId, variant, ext }) => {
  const v = String(variant || '').trim() || 'variant';
  const e = String(ext || '').trim() || 'bin';
  const nonce = crypto.randomBytes(6).toString('hex');
  return `photos/${photoId}/${v}-${nonce}.${e}`;
};

export const putPhotoObject = async ({ key, buffer, mime }) => {
  const s3 = getS3Client();
  if (!s3) return null;

  const Bucket = String(process.env.S3_BUCKET);
  await s3.send(
    new PutObjectCommand({
      Bucket,
      Key: key,
      Body: buffer,
      ContentType: mime || 'application/octet-stream',
    }),
  );

  const publicBase = String(process.env.S3_PUBLIC_BASE_URL);
  const url = joinUrl(publicBase, key);
  return { key, url };
};

export const getObjectByUrl = async (url) => {
  const s3 = getS3Client();
  if (!s3) return null;

  const key = keyFromPublicUrl(url);
  if (!key) return null;

  const Bucket = String(process.env.S3_BUCKET);
  const out = await s3.send(new GetObjectCommand({ Bucket, Key: key }));
  const buffer = await toBufferFromBody(out?.Body);
  const mime = String(out?.ContentType || 'application/octet-stream');
  return { key, buffer, mime };
};

export const deleteObjectByUrl = async (url) => {
  const s3 = getS3Client();
  if (!s3) return false;

  const base = toBase(process.env.S3_PUBLIC_BASE_URL);
  const u = String(url || '').trim();
  if (!u || !base || !u.startsWith(base + '/')) return false;

  const key = u.slice(base.length + 1);
  if (!key) return false;

  const Bucket = String(process.env.S3_BUCKET);
  await s3.send(new DeleteObjectCommand({ Bucket, Key: key }));
  return true;
};
