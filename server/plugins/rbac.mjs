import { forbidden, unauthorized } from '../lib/http_errors.mjs';
import { normalizeRole } from '../lib/roles.mjs';

export const requireRole = (roles) => {
  const allowed = new Set(
    (Array.isArray(roles) ? roles : [roles])
      .map(r => normalizeRole(r))
      .filter(Boolean),
  );

  return async (req) => {
    const user = req.authUser;
    if (!user?.id) throw unauthorized('UNAUTHORIZED', '未登录');
    const role = normalizeRole(user.role);
    if (!allowed.has(role)) throw forbidden('FORBIDDEN', '无权限');
  };
};

export const requireAdmin = () => requireRole('admin');
export const requireMember = () => requireRole(['admin', 'family']);
