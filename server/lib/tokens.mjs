import crypto from 'node:crypto';

export const generateToken = () => {
  return crypto.randomBytes(32).toString('base64url');
};

export const hashToken = (token) => {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
};

