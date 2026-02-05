ALTER TABLE photos ADD COLUMN IF NOT EXISTS image_width integer;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS image_height integer;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS image_size_bytes bigint;
