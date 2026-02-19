ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamptz;
UPDATE users SET status = 'active' WHERE status IS NULL;
UPDATE users SET status = 'disabled' WHERE disabled_at IS NOT NULL;
