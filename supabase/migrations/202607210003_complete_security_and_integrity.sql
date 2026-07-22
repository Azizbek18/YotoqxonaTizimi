-- Final security/integrity migration. Apply after all earlier migrations.

ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS phone_number text;

-- Move legacy administrator rows out of the student table before removing
-- users.role as an authorization source.
INSERT INTO public.staff (id, email, full_name, staff_id, role, status)
SELECT id, email, coalesce(full_name, email), 'MIGRATED-' || left(id::text, 8), 'admin', 'active'
FROM public.users
WHERE role = 'admin'
ON CONFLICT (id) DO UPDATE SET role = 'admin', status = 'active';
DELETE FROM public.users WHERE role = 'admin';

ALTER TABLE public.admin_invites
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.admin_invites
  ADD COLUMN IF NOT EXISTS token_hash text;
UPDATE public.admin_invites
SET token_hash = encode(digest(code, 'sha256'), 'hex')
WHERE token_hash IS NULL AND code IS NOT NULL;
ALTER TABLE public.admin_invites
  ALTER COLUMN code DROP NOT NULL,
  ALTER COLUMN token_hash SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS admin_invites_token_hash_idx
  ON public.admin_invites(token_hash);
UPDATE public.admin_invites SET code = NULL WHERE code IS NOT NULL;
UPDATE public.admin_invites
SET expires_at = created_at + interval '24 hours'
WHERE expires_at IS NULL;
ALTER TABLE public.admin_invites
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours'),
  ALTER COLUMN expires_at SET NOT NULL;

ALTER TABLE public.tolovlar
  ADD COLUMN IF NOT EXISTS receipt_hash text,
  ADD COLUMN IF NOT EXISTS transaction_id text,
  ADD COLUMN IF NOT EXISTS ai_confidence integer,
  ADD COLUMN IF NOT EXISTS ai_extracted_amount integer,
  ADD COLUMN IF NOT EXISTS ai_analysis text;
CREATE INDEX IF NOT EXISTS tolovlar_receipt_hash_idx
  ON public.tolovlar(receipt_hash) WHERE receipt_hash IS NOT NULL;

-- One row per uploaded receipt closes the check-then-insert race while still
-- allowing one receipt to cover several monthly payment rows.
CREATE TABLE IF NOT EXISTS public.payment_receipt_uploads (
  receipt_hash text PRIMARY KEY,
  batch_id uuid NOT NULL UNIQUE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  object_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_receipt_uploads ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_active_staff_role(required_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff
    WHERE id = auth.uid()
      AND status = 'active'
      AND role = ANY(required_roles)
  );
$$;
REVOKE ALL ON FUNCTION public.is_active_staff_role(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_active_staff_role(text[]) TO authenticated;

-- Student profiles: students can read their own row but all writes go through
-- validated server Route Handlers. This removes role/status/room escalation.
DROP POLICY IF EXISTS "Users can update own user profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Staff can view students" ON public.users;
DROP POLICY IF EXISTS "Zamdekan can update students" ON public.users;
DROP POLICY IF EXISTS "Active staff can view students" ON public.users;
DROP POLICY IF EXISTS "Active admins can manage students" ON public.users;
DROP POLICY IF EXISTS "Zamdekan can update faculty students" ON public.users;

CREATE POLICY "Active staff can view students"
ON public.users FOR SELECT TO authenticated
USING (role = 'talaba' AND public.is_active_staff_role(ARRAY['admin','tarbiyachi','zamdekan']));

CREATE POLICY "Active admins can manage students"
ON public.users FOR ALL TO authenticated
USING (public.is_active_staff_role(ARRAY['admin']))
WITH CHECK (role = 'talaba' AND public.is_active_staff_role(ARRAY['admin']));

CREATE POLICY "Zamdekan can update faculty students"
ON public.users FOR UPDATE TO authenticated
USING (
  role = 'talaba' AND EXISTS (
    SELECT 1 FROM public.staff
    WHERE staff.id = auth.uid() AND staff.status = 'active'
      AND staff.role = 'zamdekan'
      AND lower(staff.faculty) = lower(users.faculty)
  )
)
WITH CHECK (
  role = 'talaba' AND EXISTS (
    SELECT 1 FROM public.staff
    WHERE staff.id = auth.uid() AND staff.status = 'active'
      AND staff.role = 'zamdekan'
      AND lower(staff.faculty) = lower(users.faculty)
  )
);

-- Applications: preserve draft submission, but prevent students from
-- modifying moderation fields.
CREATE OR REPLACE FUNCTION public.protect_application_moderation_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() = OLD.student_id
     AND NOT public.is_active_staff_role(ARRAY['admin','tarbiyachi','zamdekan']) THEN
    IF NEW.student_id IS DISTINCT FROM OLD.student_id
       OR NEW.level IS DISTINCT FROM OLD.level
       OR NEW.admin_response IS DISTINCT FROM OLD.admin_response
       OR NEW.response_date IS DISTINCT FROM OLD.response_date
       OR (NEW.status IS DISTINCT FROM OLD.status
           AND NOT (OLD.status = 'draft' AND NEW.status IN ('pending','submitted'))) THEN
      RAISE EXCEPTION 'Moderation fields cannot be changed by a student';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_application_moderation_fields_trigger ON public.arizalar;
CREATE TRIGGER protect_application_moderation_fields_trigger
BEFORE UPDATE ON public.arizalar
FOR EACH ROW EXECUTE FUNCTION public.protect_application_moderation_fields();

DROP POLICY IF EXISTS "Admins can view all applications" ON public.arizalar;
DROP POLICY IF EXISTS "Admins can update all applications" ON public.arizalar;
DROP POLICY IF EXISTS "Admins can delete all applications" ON public.arizalar;
DROP POLICY IF EXISTS "Staff can view all applications" ON public.arizalar;
DROP POLICY IF EXISTS "Users can view relevant applications" ON public.arizalar;
DROP POLICY IF EXISTS "Users can update relevant applications" ON public.arizalar;
DROP POLICY IF EXISTS "Users can delete relevant applications" ON public.arizalar;
CREATE POLICY "Users can view relevant applications"
ON public.arizalar FOR SELECT TO authenticated
USING (auth.uid() = student_id OR public.is_active_staff_role(ARRAY['admin','tarbiyachi','zamdekan']));
CREATE POLICY "Users can update relevant applications"
ON public.arizalar FOR UPDATE TO authenticated
USING (auth.uid() = student_id OR public.is_active_staff_role(ARRAY['admin','tarbiyachi']))
WITH CHECK (auth.uid() = student_id OR public.is_active_staff_role(ARRAY['admin','tarbiyachi']));
CREATE POLICY "Users can delete relevant applications"
ON public.arizalar FOR DELETE TO authenticated
USING (auth.uid() = student_id OR public.is_active_staff_role(ARRAY['admin']));

-- Payments are created by /api/student/payments. Students only read them;
-- AI/moderation fields can no longer be self-approved from the browser.
DROP POLICY IF EXISTS "Students can insert their own payments" ON public.tolovlar;
DROP POLICY IF EXISTS "Students can update their own payments" ON public.tolovlar;
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.tolovlar;
DROP POLICY IF EXISTS "Staff can view all payments" ON public.tolovlar;
DROP POLICY IF EXISTS "Active admins manage payments" ON public.tolovlar;
DROP POLICY IF EXISTS "Active staff view payments" ON public.tolovlar;
CREATE POLICY "Active admins manage payments"
ON public.tolovlar FOR ALL TO authenticated
USING (public.is_active_staff_role(ARRAY['admin']))
WITH CHECK (public.is_active_staff_role(ARRAY['admin']));
CREATE POLICY "Active staff view payments"
ON public.tolovlar FOR SELECT TO authenticated
USING (public.is_active_staff_role(ARRAY['admin','tarbiyachi']));

-- Permit requests are submitted/status-checked through server endpoints.
DROP POLICY IF EXISTS "Anyone can insert permit requests" ON public.permit_requests;
DROP POLICY IF EXISTS "Anyone can select permit requests" ON public.permit_requests;
DROP POLICY IF EXISTS "Staff can manage permit requests" ON public.permit_requests;
DROP POLICY IF EXISTS "Active staff manage permit requests" ON public.permit_requests;
CREATE POLICY "Active staff manage permit requests"
ON public.permit_requests FOR ALL TO authenticated
USING (
  public.is_active_staff_role(ARRAY['admin','tarbiyachi'])
  OR EXISTS (
    SELECT 1 FROM public.staff
    WHERE staff.id = auth.uid() AND staff.status = 'active' AND staff.role = 'zamdekan'
      AND lower(staff.faculty) = lower(permit_requests.faculty)
  )
)
WITH CHECK (
  public.is_active_staff_role(ARRAY['admin','tarbiyachi'])
  OR EXISTS (
    SELECT 1 FROM public.staff
    WHERE staff.id = auth.uid() AND staff.status = 'active' AND staff.role = 'zamdekan'
      AND lower(staff.faculty) = lower(permit_requests.faculty)
  )
);

DROP POLICY IF EXISTS "Allow public select on admin_invites" ON public.admin_invites;
DROP POLICY IF EXISTS "Allow public select on staff_invites" ON public.staff_invites;
DROP POLICY IF EXISTS "Admins have full control over admin_invites" ON public.admin_invites;
DROP POLICY IF EXISTS "Admins have full control over staff_invites" ON public.staff_invites;
DROP POLICY IF EXISTS "Active admins manage admin invites" ON public.admin_invites;
DROP POLICY IF EXISTS "Active admins manage staff invites" ON public.staff_invites;
CREATE POLICY "Active admins manage admin invites"
ON public.admin_invites FOR ALL TO authenticated
USING (public.is_active_staff_role(ARRAY['admin']))
WITH CHECK (public.is_active_staff_role(ARRAY['admin']));
CREATE POLICY "Active admins manage staff invites"
ON public.staff_invites FOR ALL TO authenticated
USING (public.is_active_staff_role(ARRAY['admin']))
WITH CHECK (public.is_active_staff_role(ARRAY['admin']));

-- Audience filtering is performed by /api/elonlar. Direct published-row read
-- access would reveal faculty/floor-targeted announcements to other students.
DROP POLICY IF EXISTS "Published elonlar are readable" ON public.elonlar;

-- Browser uploads are no longer needed; service-only Route Handlers validate
-- signatures, ownership and object paths before using the service role.
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload receipts" ON storage.objects;

