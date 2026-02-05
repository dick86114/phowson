create table if not exists categories (
  value text primary key,
  label text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_categories_updated_at on categories;
create trigger trg_categories_updated_at
before update on categories
for each row
execute function set_updated_at();

insert into categories(value, label, sort_order)
values
  ('uncategorized', '未分类', 0),
  ('landscape', '风光', 10),
  ('portrait', '人像', 20),
  ('street', '街头', 30),
  ('travel', '旅行', 40),
  ('macro', '微距', 50)
on conflict (value) do nothing;

