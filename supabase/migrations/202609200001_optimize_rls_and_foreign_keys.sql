-- Resolve the actionable Supabase performance-advisor findings without
-- widening access. Server-only tables intentionally remain RLS-enabled with
-- no client policies.

CREATE INDEX IF NOT EXISTS dorm_floor_confirmed_by_idx
  ON public.dorm_floor (confirmed_by);
CREATE INDEX IF NOT EXISTS dorm_floor_pending_by_idx
  ON public.dorm_floor (pending_by);
CREATE INDEX IF NOT EXISTS elonlar_created_by_idx
  ON public.elonlar (created_by);
CREATE INDEX IF NOT EXISTS payment_receipt_uploads_student_id_idx
  ON public.payment_receipt_uploads (student_id);
CREATE INDEX IF NOT EXISTS staff_created_by_idx
  ON public.staff (created_by);
CREATE INDEX IF NOT EXISTS staff_dorm_id_idx
  ON public.staff (dorm_id);
CREATE INDEX IF NOT EXISTS staff_invites_created_by_idx
  ON public.staff_invites (created_by);

-- This index duplicates arizalar_student_id_idx from the initial schema.
DROP INDEX IF EXISTS public.idx_arizalar_student_id;

-- Wrapping auth.uid() in SELECT turns it into an initplan, so Postgres
-- evaluates it once per statement instead of once per row.
DROP POLICY IF EXISTS "Users can view own user profile" ON public.users;
CREATE POLICY "Users can view own user profile"
ON public.users FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can view relevant applications" ON public.arizalar;
CREATE POLICY "Users can view relevant applications"
ON public.arizalar FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = student_id);

DROP POLICY IF EXISTS "Staff can view own staff profile" ON public.staff;
CREATE POLICY "Staff can view own staff profile"
ON public.staff FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Students can view their own payments" ON public.tolovlar;
CREATE POLICY "Students can view their own payments"
ON public.tolovlar FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = student_id);
