import { normalizeRole } from '../lib/roles.mjs';
import { hashToken } from '../lib/tokens.mjs';
import { findSessionUserByTokenHash } from '../db/sessions.mjs';

const getBearerToken = (req) => {
  const auth = String(req.headers.authorization ?? '').trim();
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return m[1].trim();
};

export const getAuthUserFromHeaders = (req) => {
  const id = String(req.headers['x-user-id'] ?? '').trim();
  const name = String(req.headers['x-user-name'] ?? '').trim();
  const role = String(req.headers['x-user-role'] ?? '').trim();
  const avatar = String(req.headers['x-user-avatar'] ?? '').trim();

  const normalizedRole = normalizeRole(role);
  if (!id || !normalizedRole) return null;

  return {
    id,
    name: name || id,
    role: normalizedRole,
    avatar: avatar || '',
  };
};

export const registerAuth = (app) => {
  app.decorateRequest('authUser', null);

  app.addHook('preHandler', async (req) => {
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
          };
          return;
        }
      } catch {
        req.authUser = null;
      }
    }

    req.authUser = getAuthUserFromHeaders(req);
  });
};
