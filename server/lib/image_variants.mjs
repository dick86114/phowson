import sharp from 'sharp';

const toJpegBuffer = async (buffer, { maxWidth }) => {
  const img = sharp(buffer, { failOn: 'none' });
  const meta = await img.metadata();
  const width = meta.width || null;

  const pipeline = width && width > maxWidth ? img.resize({ width: maxWidth, withoutEnlargement: true }) : img;
  return pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
};

export const generatePhotoVariants = async (buffer) => {
  const [thumb, medium] = await Promise.all([
    toJpegBuffer(buffer, { maxWidth: 480 }),
    toJpegBuffer(buffer, { maxWidth: 1400 }),
  ]);

  return {
    thumb: { buffer: thumb, mime: 'image/jpeg', ext: 'jpg' },
    medium: { buffer: medium, mime: 'image/jpeg', ext: 'jpg' },
  };
};

