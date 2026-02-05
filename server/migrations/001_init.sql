create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists users (
  id text primary key,
  name text not null,
  role text not null default 'guest',
  avatar_mime text,
  avatar_bytes bytea,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists photos (
  id text primary key default gen_random_uuid()::text,
  owner_user_id text references users(id) on delete set null,
  title text not null,
  description text not null default '',
  category text not null default 'uncategorized',
  tags text[] not null default '{}',
  exif jsonb not null default '{}'::jsonb,
  image_mime text,
  image_bytes bytea,
  ai_critique text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  views_count integer not null default 0,
  likes_count integer not null default 0
);

create table if not exists photo_likes (
  photo_id text not null references photos(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (photo_id, user_id)
);

create table if not exists photo_comments (
  id text primary key default gen_random_uuid()::text,
  photo_id text not null references photos(id) on delete cascade,
  user_id text references users(id) on delete set null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_photos_created_at on photos (created_at desc);
create index if not exists idx_photos_category on photos (category);
create index if not exists idx_photo_likes_photo on photo_likes (photo_id);
create index if not exists idx_photo_comments_photo on photo_comments (photo_id);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_photos_updated_at on photos;
create trigger trg_photos_updated_at
before update on photos
for each row
execute function set_updated_at();
