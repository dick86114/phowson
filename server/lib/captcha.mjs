import svgCaptcha from 'svg-captcha';
import crypto from 'node:crypto';

const SECRET = process.env.CAPTCHA_SECRET || crypto.randomBytes(32).toString('hex');

export const createCaptcha = () => {
  const captcha = svgCaptcha.create({
    size: 4,
    ignoreChars: '0o1i',
    noise: 2,
    color: true,
  });
  
  const expires = Date.now() + 5 * 60 * 1000; // 5 mins
  const data = `${captcha.text.toLowerCase()}:${expires}`;
  const signature = crypto.createHmac('sha256', SECRET).update(data).digest('hex');
  const token = Buffer.from(`${data}:${signature}`).toString('base64');
  
  return {
    svg: captcha.data,
    token
  };
};

export const verifyCaptcha = (text, token) => {
  if (!text || !token) return false;
  
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    
    const [answer, expiresStr, signature] = parts;
    const expires = parseInt(expiresStr, 10);
    
    if (Date.now() > expires) return false;
    if (String(text).toLowerCase() !== answer) return false;
    
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(`${answer}:${expiresStr}`).digest('hex');
    if (signature !== expectedSignature) return false;
    
    return true;
  } catch {
    return false;
  }
};
