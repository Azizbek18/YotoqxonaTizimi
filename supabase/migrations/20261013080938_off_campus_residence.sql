-- KV-talaba (off-campus student) must state where they actually live on
-- first sign-in: typed by hand and/or pinned on a map. Optional coordinates
-- are only set when the address came from the map picker.
alter table public.users
  add column if not exists residence_address text,
  add column if not exists residence_lat double precision,
  add column if not exists residence_lng double precision;

comment on column public.users.residence_address is
  'Where an off-campus (KV) student lives. Null until they fill it in on first sign-in.';
