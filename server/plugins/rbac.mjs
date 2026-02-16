
import { forbidden, unauthorized } from '../lib/http_errors.mjs';
import { normalizeRole } from '../lib/roles.mjs';

// Legacy: Require specific role ID
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

// New: Require specific permission
export const requirePermission = (permission) => {
  return async (req) => {
    const user = req.authUser;
    if (!user?.id) throw unauthorized('UNAUTHORIZED', '未登录');
    const permissions = new Set(user.permissions || []);
    if (!permissions.has(permission)) throw forbidden('FORBIDDEN', '无权限');
  };
};

// Map high-level roles to permissions
export const requireAdmin = () => requirePermission('admin_access');
export const requireMember = () => requirePermission('basic_access');
