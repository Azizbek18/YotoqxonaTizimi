-- ==========================================================
-- Bosqich 2b (1-qadam) — mavjud admin hisoblariga fakultet berish
-- ==========================================================
-- Yangi modelda global admin yo'q — dekan = fakultet admini. O'tish
-- davrida mavjud admin hisoblari asosiy (AMIT) binoning dekani sifatida
-- ishlaydi: `staffFacultyOrPrimary` allaqachon fakultetsiz staff'ni 'amit'
-- ga tenglaydi, bu migratsiya esa buni ma'lumotda mustahkamlaydi.
--
-- `role` HALI o'zgarmaydi (admin roli hali `/admin/*` sahifalari va
-- `is_admin()` RLS yordamchisida ishlatiladi) — u Bosqich 2b ning
-- keyingi qadamlarida (proxy guard, sahifa birlashtirish) olib tashlanadi.

UPDATE public.staff
SET faculty = 'amit'
WHERE role = 'admin'
  AND (faculty IS NULL OR trim(faculty) = '');
