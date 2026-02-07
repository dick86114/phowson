create table if not exists user_settings (
  user_id text primary key references users(id) on delete cascade,
  daily_upload_goal integer,
  updated_at timestamptz not null default now()
);

create or replace function set_user_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_settings_updated_at on user_settings;
create trigger trg_user_settings_updated_at
before update on user_settings
for each row
execute function set_user_settings_updated_at();

