-- ==========================================================
-- ZAMDEKAN FACULTY SCOPING MIGRATION
-- Execute this SQL script in your Supabase SQL Editor.
-- Same content is also appended to the end of DATABASE_SCHEMA.sql
-- for future fresh installs.
-- ==========================================================

-- 1. Add a faculty column to staff (used to scope a zamdekan's own faculty)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS faculty text;

-- 2. Tighten permit_requests access: admin/tarbiyachi keep full access,
--    zamdekan is restricted to rows matching their own assigned faculty
--    (case-insensitive, since faculty is free text on the applicant form).
DROP POLICY IF EXISTS "Staff can manage permit requests" ON permit_requests;
CREATE POLICY "Staff can manage permit requests"
ON permit_requests FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
      AND (
        staff.role IN ('admin', 'tarbiyachi')
        OR (staff.role = 'zamdekan' AND lower(staff.faculty) = lower(permit_requests.faculty))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
      AND (
        staff.role IN ('admin', 'tarbiyachi')
        OR (staff.role = 'zamdekan' AND lower(staff.faculty) = lower(permit_requests.faculty))
      )
  )
);

-- 3. IMPORTANT: any zamdekan accounts created before this migration will
--    have faculty = NULL. They will see zero permit requests (fail-safe,
--    not fail-open) until you set their faculty manually, e.g.:
--    UPDATE staff SET faculty = 'Amaliy Matematika va Informatika Texnologiyalari'
--    WHERE email = 'zamdekan@example.com';
