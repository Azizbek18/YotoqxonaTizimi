-- A council chair's announcement is its own audience value (facultywide,
-- gender-scoped via target_gender, no target_floor) — add it to elonlar's
-- allow-list alongside the existing all/faculty/floor/internal/system.
alter table public.elonlar drop constraint if exists elonlar_audience_check;
alter table public.elonlar add constraint elonlar_audience_check
  check (audience = any (array['all', 'faculty', 'floor', 'internal', 'system', 'council']));
