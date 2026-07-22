-- Production security hardening
-- Apply this migration after all earlier schema migrations.

-- Private permit documents. Applications store the object path in permit_url.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'permits',
  'permits',
  false,
  5242880,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Permit submission/status now goes through server-only Route Handlers.
DROP POLICY IF EXISTS "Anyone can insert permit requests" ON public.permit_requests;
DROP POLICY IF EXISTS "Anyone can select permit requests" ON public.permit_requests;

-- Do not expose staff rows or invitation secrets to anonymous clients.
DROP POLICY IF EXISTS "Anon email orqali mavjudligini tekshiradi" ON public.staff;
DROP POLICY IF EXISTS "Allow public select on admin_invites" ON public.admin_invites;
DROP POLICY IF EXISTS "Allow public select on staff_invites" ON public.staff_invites;

-- Avatar uploads must be authenticated and constrained to the caller's folder.
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload own avatar" ON storage.objects;
CREATE POLICY "Authenticated users upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('avatar', 'avatars')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Cleaning schedules contain room information and may only be read by signed-in
-- users. A student may mutate their own room; active staff may administer it.
DROP POLICY IF EXISTS "Allow public read access" ON public.cleaning_schedule;
DROP POLICY IF EXISTS "Allow authenticated insert/update" ON public.cleaning_schedule;
DROP POLICY IF EXISTS "Authenticated users read cleaning schedules" ON public.cleaning_schedule;
DROP POLICY IF EXISTS "Residents or staff manage cleaning schedule" ON public.cleaning_schedule;

CREATE POLICY "Authenticated users read cleaning schedules"
ON public.cleaning_schedule FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Residents or staff manage cleaning schedule"
ON public.cleaning_schedule FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.room_number = cleaning_schedule.room_number
  )
  OR EXISTS (
    SELECT 1 FROM public.staff
    WHERE staff.id = auth.uid()
      AND staff.status = 'active'
      AND staff.role IN ('admin', 'tarbiyachi')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.room_number = cleaning_schedule.room_number
  )
  OR EXISTS (
    SELECT 1 FROM public.staff
    WHERE staff.id = auth.uid()
      AND staff.status = 'active'
      AND staff.role IN ('admin', 'tarbiyachi')
  )
);

-- Audit events are server-written only.
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'denied', 'error')),
  ip_address text,
  actor_user_id uuid,
  target_role text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS security_audit_logs_created_at_idx
  ON public.security_audit_logs(created_at DESC);
