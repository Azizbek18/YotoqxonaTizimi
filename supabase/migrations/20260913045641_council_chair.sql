-- Turns "Talaba kengashi raisi" (student council chairman) from a manually
-- typed name+phone snapshot in Sozlamalar into a real role: the dekan
-- appoints an actual student, who then gets their own panel scoped to their
-- own gender across the whole faculty (not one floor, like a sardor).
--
-- One chair per (faculty, gender) — enforced the same way a floor captain's
-- one-per-(faculty, floor, gender) slot is: a partial unique index plus an
-- atomic promote RPC that demotes whoever currently holds the slot before
-- handing it to the new student.

alter table public.users
  add column if not exists is_council_chair boolean not null default false;

alter table public.users
  add column if not exists council_chair_permissions jsonb not null default '{}'::jsonb;

comment on column public.users.is_council_chair is
  'True for the one student per (faculty, gender) currently serving as talaba kengashi raisi. See promote_council_chair().';
comment on column public.users.council_chair_permissions is
  'Revoked permissions for this student while they are council chair. Empty = full access. Catalogue: features/permissions/types.ts';

create unique index if not exists users_council_chair_unique_idx
  on public.users (coalesce(nullif(faculty, ''), 'amit'), gender)
  where (is_council_chair = true);

-- Mirrors promote_floor_captain (202607280012): locks the (faculty, gender)
-- slot, demotes its current holder (if any), then sets the target row.
-- Unlike a floor captain, chairmanship doesn't carry its own floor/gender
-- assignment to write — it only ever reads the student's own existing
-- gender to find the slot to lock and clear.
create or replace function public.promote_council_chair(p_user_id uuid, p_is_chair boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_faculty text;
  v_gender text;
begin
  select coalesce(nullif(faculty, ''), 'amit'), gender into v_faculty, v_gender
  from public.users where id = p_user_id for update;
  if not found then
    raise exception 'Target user does not exist' using errcode = 'P0001';
  end if;

  if p_is_chair and v_gender is not null then
    perform pg_advisory_xact_lock(
      hashtext('council-chair:' || v_faculty || ':' || v_gender)
    );

    update public.users
    set is_council_chair = false
    where is_council_chair = true
      and coalesce(nullif(faculty, ''), 'amit') = v_faculty
      and gender = v_gender
      and id <> p_user_id;
  end if;

  update public.users
  set is_council_chair = p_is_chair
  where id = p_user_id;
end;
$$;

-- No explicit GRANT: 202607280021's ALTER DEFAULT PRIVILEGES already keeps
-- new functions un-callable by anon/authenticated, so only service_role
-- (the only client this RPC is ever invoked from) can execute it.
