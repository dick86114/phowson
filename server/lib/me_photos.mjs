export const parseListParam = (raw) => {
  if (raw === undefined || raw === null) return [];
  const arr = Array.isArray(raw) ? raw : String(raw).split(',');
  return arr.map((s) => String(s).trim()).filter(Boolean);
};

export const buildMePhotosWhere = ({ userId, year, month, day, excludeYear, category, tags, camera }) => {
  const parts = ['p.owner_user_id = $1'];
  const params = [String(userId)];
  let i = 2;

  if (Number.isFinite(year) && year > 0) {
    parts.push(`extract(year from p.created_at) = $${i}`);
    params.push(year);
    i++;
  }

  if (Number.isFinite(excludeYear) && excludeYear > 0) {
    parts.push(`extract(year from p.created_at) != $${i}`);
    params.push(excludeYear);
    i++;
  }

  if (Number.isFinite(month) && month >= 1 && month <= 12) {
    parts.push(`extract(month from p.created_at) = $${i}`);
    params.push(month);
    i++;
  }

  if (Number.isFinite(day) && day >= 1 && day <= 31) {
    parts.push(`extract(day from p.created_at) = $${i}`);
    params.push(day);
    i++;
  }

  if (category && category !== 'all') {
    parts.push(`p.category = $${i}`);
    params.push(category);
    i++;
  }

  if (Array.isArray(tags) && tags.length > 0) {
    parts.push(`p.tags && $${i}::text[]`);
    params.push(tags);
    i++;
  }

  if (camera) {
    parts.push(`coalesce(p.exif->>'Model','') ilike $${i}`);
    params.push(`%${String(camera).trim()}%`);
    i++;
  }

  return {
    whereSql: parts.length ? ` where ${parts.join(' and ')}` : '',
    params,
  };
};
