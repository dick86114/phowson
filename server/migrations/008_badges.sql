create table if not exists badges (
    id text primary key,
    name text not null,
    description text,
    icon text,
    icon_color text default '#6366f1',
    condition_type text not null,
    condition_config jsonb not null,
    xp_reward integer default 0,
    is_active boolean default true,
    sort_order integer default 0,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create index if not exists idx_badges_is_active on badges(is_active) where is_active = true;
create index if not exists idx_badges_sort_order on badges(sort_order);

create table if not exists user_badges (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    badge_id text not null references badges(id) on delete cascade,
    earned_at timestamp with time zone default now(),
    unique(user_id, badge_id)
);

create index if not exists idx_user_badges_user_id on user_badges(user_id);
create index if not exists idx_user_badges_earned_at on user_badges(earned_at desc);
