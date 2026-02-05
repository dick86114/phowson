create table if not exists activity_logs (
  day date not null,
  user_id text not null references users(id) on delete cascade,
  uploads_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (day, user_id)
);

create index if not exists idx_activity_logs_user_day on activity_logs (user_id, day desc);

create or replace function set_activity_logs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_activity_logs_updated_at on activity_logs;
create trigger trg_activity_logs_updated_at
before update on activity_logs
for each row
execute function set_activity_logs_updated_at();

