ALTER TABLE photos
ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_photos_public_created_at
ON photos (created_at DESC)
WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_photos_public_updated_at
ON photos (updated_at ASC, id ASC)
WHERE is_public = true;
