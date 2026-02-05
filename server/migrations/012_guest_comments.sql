
ALTER TABLE photo_comments ADD COLUMN IF NOT EXISTS guest_nickname TEXT;
ALTER TABLE photo_comments ADD COLUMN IF NOT EXISTS guest_email TEXT;
ALTER TABLE photo_comments ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE photo_likes ADD COLUMN IF NOT EXISTS guest_id TEXT;

-- Drop old PK first
ALTER TABLE photo_likes DROP CONSTRAINT IF EXISTS photo_likes_pkey;

-- Then modify column
ALTER TABLE photo_likes ALTER COLUMN user_id DROP NOT NULL;

-- Add new unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS photo_likes_user_idx ON photo_likes (photo_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS photo_likes_guest_idx ON photo_likes (photo_id, guest_id) WHERE guest_id IS NOT NULL;
