
create table if not exists operation_logs (
  id serial primary key,
  operator_id text not null,
  target_user_id text not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_operation_logs_target on operation_logs(target_user_id);
create index if not exists idx_operation_logs_operator on operation_logs(operator_id);
