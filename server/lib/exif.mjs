const toNum = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const toDateOnly = (v) => {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const formatAperture = (v) => {
  const n = toNum(v);
  if (n == null) return String(v || '');
  return `f/${n}`;
};

const formatFocalLength = (v) => {
  const n = toNum(v);
  if (n == null) return String(v || '');
  return `${n}mm`;
};

const formatShutter = (v) => {
  const n = toNum(v);
  if (n == null) return String(v || '');
  if (n <= 0) return '';
  if (n >= 1) return `${n}s`;
  const inv = Math.round(1 / n);
  if (!Number.isFinite(inv) || inv <= 0) return '';
  return `1/${inv}s`;
};

const pickLatLng = (source) => {
  const lat = toNum(source.lat ?? source.latitude ?? source.GPSLatitude);
  const lng = toNum(source.lng ?? source.lon ?? source.longitude ?? source.GPSLongitude);
  if (lat == null || lng == null) return { lat: null, lng: null };
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { lat: null, lng: null };
  return { lat, lng };
};

export const normalizeExif = (raw) => {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

  const cameraRaw = source.camera ?? source.Model ?? '';
  const lensRaw = source.lens ?? source.LensModel ?? '';

  const fNumberRaw = source.FNumber ?? source.aperture ?? '';
  const exposureRaw = source.ExposureTime ?? source.shutterSpeed ?? '';
  const isoRaw = source.ISO ?? source.iso ?? '';
  const focalRaw = source.FocalLength ?? source.focalLength ?? '';

  const locationRaw = source.location ?? '';
  const dateRaw = source.date ?? source.DateTimeOriginal ?? source.CreateDate ?? source.DateTime ?? '';
  const date = toDateOnly(dateRaw);

  const { lat, lng } = pickLatLng(source);

  const camera = String(cameraRaw || '');
  const lens = String(lensRaw || '');
  const iso = isoRaw == null ? '' : String(isoRaw);

  const aperture = formatAperture(fNumberRaw);
  const shutterSpeed = formatShutter(exposureRaw);
  const focalLength = formatFocalLength(focalRaw);

  const out = {
    camera,
    lens,
    aperture: String(aperture || ''),
    shutterSpeed: String(shutterSpeed || ''),
    iso: String(iso || ''),
    focalLength: String(focalLength || ''),
    location: String(locationRaw || ''),
    date,
    Model: camera,
    LensModel: lens,
    FNumber: fNumberRaw == null ? '' : String(fNumberRaw),
    ExposureTime: exposureRaw == null ? '' : String(exposureRaw),
    ISO: isoRaw == null ? '' : String(isoRaw),
    FocalLength: focalRaw == null ? '' : String(focalRaw),
  };

  if (lat != null && lng != null) {
    out.lat = lat;
    out.lng = lng;
  }

  return out;
};
