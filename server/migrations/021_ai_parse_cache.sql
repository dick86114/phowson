create table if not exists ai_parse_cache (
  cache_key text primary key,
  parse_type text not null,
  result jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_parse_cache_expires_at on ai_parse_cache (expires_at);
