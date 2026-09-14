-- KV-talaba (off-campus student): a talaba who studies at the university
-- but lives off-campus (rented apartment), not a dormitory resident. They
-- need an account overseen by the dekan, with no document/permit
-- requirement — but they are structurally nothing like a dorm resident (no
-- room, no floor, no sardor/cleaning/attendance/payments).
--
-- Modeled as a flag on `users`, not a new `role` value or a new table —
-- mirrors is_floor_captain/is_council_chair exactly. role stays 'talaba',
-- so requireActiveStudent/isActiveStudent, every RLS policy keyed on
-- role = 'talaba', and every other "the caller is a student" check keep
-- working untouched. room_number/dorm_id/assigned_floor stay permanently
-- NULL for these rows, which is already legal — enforce_dorm_id_when_roomed
-- (20260904000836) only fires when room_number IS NOT NULL.
alter table public.users
  add column if not exists is_off_campus boolean not null default false;

-- How this row was let in. 'dekan' today (the only interim verification
-- method v1 ships with); 'oneid' reserved for the HEMIS/OneID integration
-- planned as a later, contained swap — no schema change needed when it
-- lands, just a new value written here.
alter table public.users
  add column if not exists off_campus_verified_by text;
alter table public.users
  add column if not exists off_campus_verified_at timestamptz;

-- Optional today, load-bearing once HEMIS/OneID exists: the university's
-- own HEMIS student ID, given by the applicant even now so a dekan can
-- cross-check it by hand — the exact field an automated check will later
-- read instead of trusting the dekan's judgement.
alter table public.users
  add column if not exists hemis_student_id text;

comment on column public.users.is_off_campus is
  'True for a KV-talaba (off-campus student) account — role stays ''talaba'',
   but room_number/dorm_id/assigned_floor stay permanently null and no
   permit_requests row ever exists for them. See server/auth/off-campus.ts.';
comment on column public.users.off_campus_verified_by is
  'How an off-campus account was verified: ''dekan'' (v1 manual approval) or
   ''oneid'' (future HEMIS/OneID auto-verification). Null until approved.';
