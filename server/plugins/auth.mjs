import { normalizeRole } from '../lib/roles.mjs';
import { hashToken } from '../lib/tokens.mjs';
import { findSessionUserByTokenHash } from '../db/sessions.mjs';

const readCookie = (req, name) => {
  const raw = String(req.headers.cookie ?? '').trim();
  if (!raw) return null;
  const parts = raw.split(';');
  for (const part of parts) {
    const p = part.trim();
    if (!p) continue;
    const idx = p.indexOf('=');
    if (idx <= 0) continue;
    const k = p.slice(0, idx).trim();
    if (k !== name) continue;
    const v = p.slice(idx + 1).trim();
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return null;
};

const getBearerToken = (req) => {
  const auth = String(req.headers.authorization ?? '').trim();
  if (auth) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
  }

  const cookieToken = readCookie(req, 'phowson_token') || readCookie(req, 'photologs_token');
  if (cookieToken) return String(cookieToken).trim() || null;

  return null;
};

export const getAuthUserFromHeaders = (req) => {
  const id = String(req.headers['x-user-id'] ?? '').trim();
  const name = String(req.headers['x-user-name'] ?? '').trim();
  const role = String(req.headers['x-user-role'] ?? '').trim();
  const permissionsStr = String(req.headers['x-user-permissions'] ?? '').trim();
  const avatar = String(req.headers['x-user-avatar'] ?? '').trim();

  const normalizedRole = normalizeRole(role);
  if (!id || !normalizedRole) return null;

  const defaultPermissions = (() => {
    if (normalizedRole === 'admin') return ['admin_access', 'basic_access'];
    if (normalizedRole === 'family') return ['basic_access'];
    return [];
  })();

  return {
    id,
    name: name || id,
    role: normalizedRole,
    avatar: avatar || '',
    permissions: permissionsStr ? permissionsStr.split(',') : defaultPermissions,
  };
};

export const registerAuth = (app) => {
  app.decorateRequest('authUser', null);

  app.addHook('preHandler', async (req, reply) => {
    const token = getBearerToken(req);
    if (token) {
      try {
        const user = await findSessionUserByTokenHash(hashToken(token));
        if (user?.id && normalizeRole(user.role)) {
          req.authUser = {
            id: String(user.id),
            name: String(user.name ?? user.id),
            role: normalizeRole(user.role),
            avatar: String(user.avatar ?? ''),
            permissions: Array.isArray(user.permissions) ? user.permissions : [],
          };

          if (String(req.headers.authorization ?? '').trim()) {
            const forwardedProto = String(req.headers['x-forwarded-proto'] ?? '').trim().toLowerCase();
            const secure = forwardedProto === 'https';
            const ttlDaysRaw = Number(process.env.SESSION_TTL_DAYS);
            const ttlDays = Number.isFinite(ttlDaysRaw) && ttlDaysRaw > 0 ? ttlDaysRaw : 30;
            const maxAge = Math.floor(ttlDays * 24 * 60 * 60);
            const cookie = [
              `phowson_token=${encodeURIComponent(token)}`,
              'Path=/',
              'HttpOnly',
              'SameSite=Lax',
              `Max-Age=${maxAge}`,
              secure ? 'Secure' : '',
            ]
              .filter(Boolean)
              .join('; ');
            reply.header('set-cookie', cookie);
          }
          return;
        }
      } catch {
        req.authUser = null;
      }
    }

    req.authUser = getAuthUserFromHeaders(req);
  });
};
