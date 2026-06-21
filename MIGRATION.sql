-- ==========================================================
-- ZAMDEKAN ROLE AND PRE-REGISTRATION PERMITS MIGRATION
-- Execute this SQL script in your Supabase SQL Editor
-- ==========================================================

-- 1. Modify check constraint on staff role to include 'zamdekan'
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('admin', 'tarbiyachi', 'zamdekan'));

-- 2. Add permit_url column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS permit_url text;

-- 3. Create permit_requests table
CREATE TABLE IF NOT EXISTS permit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_series text UNIQUE NOT NULL,
  jshshir text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text NOT NULL,
  gender text NOT NULL,
  faculty text NOT NULL,
  direction text NOT NULL,
  course integer NOT NULL,
  permit_url text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'registered')),
  room_number text,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Enable RLS on permit_requests
ALTER TABLE permit_requests ENABLE ROW LEVEL SECURITY;

-- 5. Add RLS policies for permit_requests
DROP POLICY IF EXISTS "Anyone can insert permit requests" ON permit_requests;
CREATE POLICY "Anyone can insert permit requests"
ON permit_requests FOR INSERT
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can select permit requests" ON permit_requests;
CREATE POLICY "Anyone can select permit requests"
ON permit_requests FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Staff can manage permit requests" ON permit_requests;
CREATE POLICY "Staff can manage permit requests"
ON permit_requests FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
  )
);

-- 6. Update users table policies to support 'zamdekan' role
DROP POLICY IF EXISTS "Staff can view students" ON users;
CREATE POLICY "Staff can view students"
ON users FOR SELECT
TO authenticated
USING (
  role = 'talaba'
  AND EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
      AND staff.role IN ('admin', 'tarbiyachi', 'zamdekan')
      AND staff.status = 'active'
  )
);

DROP POLICY IF EXISTS "Zamdekan can update students" ON users;
CREATE POLICY "Zamdekan can update students"
ON users FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
      AND staff.role = 'zamdekan'
      AND staff.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
      AND staff.role = 'zamdekan'
      AND staff.status = 'active'
  )
);

-- 7. Update arizalar table policies to support 'zamdekan' role
DROP POLICY IF EXISTS "Zamdekan can update all applications" ON arizalar;
CREATE POLICY "Zamdekan can update all applications"
ON arizalar FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid() AND staff.role = 'zamdekan' AND staff.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid() AND staff.role = 'zamdekan' AND staff.status = 'active'
  )
);

-- 8. enforce_student_permit_approved FUNCTION AND TRIGGER
CREATE OR REPLACE FUNCTION check_student_permit_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'talaba' THEN
    IF NOT EXISTS (
      SELECT 1 FROM permit_requests
      WHERE passport_series = NEW.passport_series
        AND jshshir = NEW.jshshir
        AND status = 'approved'
    ) THEN
      RAISE EXCEPTION 'Ushbu talabaning yotoqxona yo''llanmasi dekan (zamdekan) tomonidan tasdiqlanmagan. Ro''yxatdan o''tish taqiqlanadi!';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_student_permit_approved_trigger ON users;
CREATE TRIGGER enforce_student_permit_approved_trigger
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION check_student_permit_approved();
