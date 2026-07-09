-- ==========================================================
-- TUZATISH: Sardor (qavat sardori) navbatchilik jadvalini saqlay olmasligi
-- Ushbu skriptni Supabase SQL Editor'da ishga tushiring.
--
-- Muammo: audience CHECK cheklovi tuzatilgandan keyin ham, Sardor
-- "Navbatchilik jadvali"ni saqlaganda hali ham xatolik bilan tugaydi:
--   {"code":42501, "message":"new row violates row-level security
--   policy for table \"elonlar\""}
--
-- Sabab: app/sardor/dashboard/page.tsx (handleSaveDuty) "elonlar"
-- jadvaliga to'g'ridan-to'g'ri (brauzerdan, authenticated kalit bilan)
-- INSERT/UPDATE qiladi, lekin "elonlar" jadvalida faqat admin/staff
-- uchun yozish policy'lari bor edi — qavat sardorlari (users.role='talaba',
-- is_floor_captain=true) uchun mos policy umuman yaratilmagan edi.
-- ==========================================================

DROP POLICY IF EXISTS "Floor captains can manage duty schedule" ON elonlar;
CREATE POLICY "Floor captains can manage duty schedule"
ON elonlar FOR ALL
TO authenticated
USING (
  title = 'HAFTALIK_NAVBATCHILIK_JADVALI'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.is_floor_captain = true
      AND users.assigned_floor = elonlar.target_floor
      AND users.gender = elonlar.target_gender
  )
)
WITH CHECK (
  title = 'HAFTALIK_NAVBATCHILIK_JADVALI'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.is_floor_captain = true
      AND users.assigned_floor = elonlar.target_floor
      AND users.gender = elonlar.target_gender
  )
);
