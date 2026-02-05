export const normalizeRole = (raw) => {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'admin') return 'admin';
  if (v === 'family') return 'family';
  if (v === 'administrator') return 'admin';
  if (v === 'member') return 'family';
  if (v === 'admin_user') return 'admin';
  return null;
};

export const isAdmin = (role) => normalizeRole(role) === 'admin';
export const isFamily = (role) => normalizeRole(role) === 'family';
