
export const normalizeRole = (raw) => {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return null;
  // Map legacy aliases
  if (v === 'administrator') return 'admin';
  if (v === 'member') return 'family';
  if (v === 'admin_user') return 'admin';
  return v;
};

export const isAdmin = (role) => normalizeRole(role) === 'admin';
export const isFamily = (role) => normalizeRole(role) === 'family';
