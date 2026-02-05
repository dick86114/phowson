alter table photos add column if not exists lat double precision;
alter table photos add column if not exists lng double precision;

create index if not exists idx_photos_gps on photos (lat, lng) where lat is not null and lng is not null;
