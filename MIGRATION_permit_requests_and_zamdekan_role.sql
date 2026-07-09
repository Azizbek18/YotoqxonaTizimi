-- ==========================================================
-- YO'LLANMA (permit_requests) VA ZAMDEKAN ROLI: TO'LIQ TUZATISH
-- Ushbu skriptni Supabase SQL Editor'da ishga tushiring.
--
-- Muammo: "Talaba yo'llanmani zamdekanga yuborishi" funksiyasini brauzerda
-- test qilishga urinilganda, quyidagilar production bazada UMUMAN
-- topilmadi (DATABASE_SCHEMA.sql'da yozilgan bo'lsa ham, hech qachon
-- ishga tushirilmagan ko'rinadi):
--   1. "permit_requests" jadvali butunlay yo'q (404 "Could not find the
--      table 'public.permit_requests'") — talaba yo'llanma yubora olmaydi.
--   2. "staff_role_check" cheklovi hali ham faqat 'admin'/'tarbiyachi'ni
--      ruxsat etadi — 'zamdekan' rolidagi hisob umuman yaratib bo'lmaydi
--      (23514 constraint violation).
--   3. "staff.faculty" ustuni yo'q — zamdekanni fakultetga biriktirib
--      bo'lmaydi, shuning uchun u hech qanday ariza ko'rmaydi.
--
-- Bu skript DATABASE_SCHEMA.sql'dagi "ZAMDEKAN ROLE AND
-- PRE-REGISTRATION PERMITS SCHEMA" + "ZAMDEKAN FACULTY SCOPING"
-- bo'limlarining aynan o'zi — faqat alohida ishga tushirish uchun
-- ajratilgan.
-- ==========================================================

-- 1. "staff" rolига 'zamdekan'ni qo'shish
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('admin', 'tarbiyachi', 'zamdekan'));

-- 2. "users" jadvaliga permit_url ustunini qo'shish
ALTER TABLE users ADD COLUMN IF NOT EXISTS permit_url text;

-- 3. permit_requests jadvalini yaratish
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

ALTER TABLE permit_requests ENABLE ROW LEVEL SECURITY;

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

-- (4-qadamda fakultet bo'yicha cheklangan versiyasi bilan almashtiriladi)
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

-- 4. "users" jadvali policy'larini 'zamdekan' rolini qo'llab-quvvatlash uchun yangilash
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

-- 5. "arizalar" jadvali policy'sini 'zamdekan' rolini qo'llab-quvvatlash uchun yangilash
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

-- 6. Ro'yxatdan o'tishda tasdiqlangan yo'llanmani talab qiluvchi trigger
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

-- 7. ZAMDEKAN FAKULTET CHEKLOVI: zamdekan faqat o'z fakultetiga tegishli
--    yo'llanmalarni ko'rishi/boshqarishi kerak.
ALTER TABLE staff ADD COLUMN IF NOT EXISTS faculty text;

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

-- IMPORTANT: bu migratsiyadan oldin yaratilgan zamdekan hisoblarida
-- faculty = NULL bo'ladi va ular hech qanday ariza ko'rmaydi (xavfsiz
-- standart holat). Kerak bo'lsa qo'lda o'rnating, masalan:
--   UPDATE staff SET faculty = 'amit' WHERE email = 'zamdekan@example.com';

-- Tekshiruv: permit_requests jadvali va staff.faculty ustuni mavjudligini tasdiqlaydi
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='permit_requests') AS permit_requests_exists,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='staff' AND column_name='faculty') AS staff_faculty_exists;
