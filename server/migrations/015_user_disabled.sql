alter table users
  add column if not exists disabled_at timestamptz;

create index if not exists users_disabled_at_idx on users(disabled_at);

