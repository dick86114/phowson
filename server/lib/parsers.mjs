export const parseTags = (raw) => {
  const str = String(raw ?? '').trim();
  if (!str) return [];
  return str
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
};

export const safeJsonParse = (raw, fallback) => {
  try {
    if (raw == null) return fallback;
    if (typeof raw === 'object') return raw;
    const str = String(raw).trim();
    if (!str) return fallback;
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

