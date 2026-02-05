import { pool } from '../db.mjs';
import { HttpError, notFound } from './http_errors.mjs';
import { getObjectByUrl, isObjectStorageEnabled } from './object_storage.mjs';

const fetchAsBuffer = async (url) => {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new HttpError(502, 'IMAGE_FETCH_FAILED', `拉取图片失败(${res.status})`);
  const mime = res.headers.get('content-type') || 'application/octet-stream';
  const arrayBuf = await res.arrayBuffer();
  return { buffer: Buffer.from(arrayBuf), mime };
};

export const getPhotoImage = async (id) => {
  const r = await pool.query('select image_mime, image_bytes, image_url from photos where id=$1', [String(id)]);
  if (r.rowCount === 0) throw notFound('PHOTO_NOT_FOUND', '照片不存在');
  const row = r.rows[0];
  if (row.image_bytes) return { buffer: row.image_bytes, mime: row.image_mime || 'image/jpeg' };
  if (row.image_url) {
    if (isObjectStorageEnabled()) {
      const obj = await getObjectByUrl(String(row.image_url));
      if (obj?.buffer?.length) return { buffer: obj.buffer, mime: obj.mime || row.image_mime || 'image/jpeg' };
    }
    return fetchAsBuffer(String(row.image_url));
  }
  throw new HttpError(404, 'IMAGE_NOT_AVAILABLE', '图片不可用');
};
