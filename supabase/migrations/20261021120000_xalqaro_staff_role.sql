-- International-office ("xalqaro") staff role: a cross-faculty, read-only view of
-- foreign students' visa / registration (propiska) documents.
--
-- Only the two role CHECK constraints need to learn the new value. Nothing else
-- in the database grants staff access by "being staff": every RLS helper
-- (is_admin, is_active_staff_role(...)) tests explicit role names, so a
-- `xalqaro` account gets no table access of its own — the /xalqaro API reads
-- through the service role after its own role check.

ALTER TABLE public.staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE public.staff
  ADD CONSTRAINT staff_role_check
  CHECK (role = ANY (ARRAY['admin'::text, 'tarbiyachi'::text, 'dekan'::text, 'xalqaro'::text]));

ALTER TABLE public.staff_invites DROP CONSTRAINT IF EXISTS staff_invites_role_check;
ALTER TABLE public.staff_invites
  ADD CONSTRAINT staff_invites_role_check
  CHECK (role = ANY (ARRAY['tarbiyachi'::text, 'dekan'::text, 'xalqaro'::text]));
