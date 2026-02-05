import crypto from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 64;

export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(password), salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `${salt.toString('base64')}.${key.toString('base64')}`;
};

export const verifyPassword = (password, stored) => {
  try {
    const [saltB64, keyB64] = String(stored ?? '').split('.');
    if (!saltB64 || !keyB64) return false;
    const salt = Buffer.from(saltB64, 'base64');
    const key = Buffer.from(keyB64, 'base64');
    const derived = crypto.scryptSync(String(password), salt, key.length, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
    return crypto.timingSafeEqual(key, derived);
  } catch {
    return false;
  }
};

