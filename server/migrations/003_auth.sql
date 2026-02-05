alter table users
  add column if not exists email text,
  add column if not exists password_hash text;

create unique index if not exists users_email_uq on users(email) where email is not null;

alter table users alter column role set default 'family';

create table if not exists sessions (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists sessions_expires_at_idx on sessions(expires_at);

