alter table photos add column if not exists image_variants jsonb not null default '{}'::jsonb;
