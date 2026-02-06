ALTER TABLE photo_comments ADD COLUMN IF NOT EXISTS guest_id TEXT;
ALTER TABLE photo_comments ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE photo_comments ADD COLUMN IF NOT EXISTS reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE photo_comments ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE photo_comments ADD COLUMN IF NOT EXISTS review_reason TEXT;
ALTER TABLE photo_comments ADD COLUMN IF NOT EXISTS client_ip TEXT;
ALTER TABLE photo_comments ADD COLUMN IF NOT EXISTS user_agent TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'photo_comments_status_check'
  ) THEN
    ALTER TABLE photo_comments
      ADD CONSTRAINT photo_comments_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_photo_comments_status_created_at ON photo_comments (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_comments_photo_created_at ON photo_comments (photo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photo_comments_guest_email ON photo_comments (guest_email) WHERE guest_email IS NOT NULL;
