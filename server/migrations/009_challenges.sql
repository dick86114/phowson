create table if not exists challenges (
    id text primary key,
    title text not null,
    description text,
    challenge_type text not null,
    config jsonb not null,
    start_date date not null,
    end_date date not null,
    xp_reward integer default 0,
    is_active boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create index if not exists idx_challenges_dates on challenges(start_date, end_date);
create index if not exists idx_challenges_is_active on challenges(is_active) where is_active = true;

create table if not exists user_challenges (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    challenge_id text not null references challenges(id) on delete cascade,
    joined_at timestamp with time zone default now(),
    completed_at timestamp with time zone,
    unique(user_id, challenge_id)
);

create index if not exists idx_user_challenges_user_id on user_challenges(user_id);
create index if not exists idx_user_challenges_status on user_challenges(user_id, completed_at);

create table if not exists challenge_progress (
    id text primary key,
    user_id text not null references users(id) on delete cascade,
    challenge_id text not null references challenges(id) on delete cascade,
    progress_type text not null,
    current_value integer default 0,
    target_value integer not null,
    updated_at timestamp with time zone default now(),
    unique(user_id, challenge_id, progress_type)
);

create index if not exists idx_challenge_progress_lookup on challenge_progress(user_id, challenge_id);
