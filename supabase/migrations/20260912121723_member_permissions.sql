-- Per-person permissions the dekan can revoke at any time (Telegram-style
-- admin rights), for the two members who act on a faculty's behalf:
--   * tarbiyachi -> staff.permissions
--   * sardor (floor captain) -> users.captain_permissions
--
-- The default is an empty object and an ABSENT KEY MEANS ALLOWED: the map
-- only ever records what has been taken away. That keeps this migration
-- non-breaking — every existing tarbiyachi and captain keeps exactly the
-- access they have today the moment the column lands, rather than being
-- locked out until a dekan ticks their boxes.

alter table public.staff
  add column if not exists permissions jsonb not null default '{}'::jsonb;

alter table public.users
  add column if not exists captain_permissions jsonb not null default '{}'::jsonb;

comment on column public.staff.permissions is
  'Revoked permissions for this staff member, e.g. {"payments.review": false}. Empty = full access. Catalogue: features/permissions/types.ts';

comment on column public.users.captain_permissions is
  'Revoked permissions for this student while they are a floor captain (is_floor_captain). Empty = full access. Catalogue: features/permissions/types.ts';

-- Guards read these columns on every request as part of the row they already
-- fetch, so no extra index is needed; they are never filtered on.
