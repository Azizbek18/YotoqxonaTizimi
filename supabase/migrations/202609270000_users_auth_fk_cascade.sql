-- ==========================================================
-- users.id -> auth.users(id): ON DELETE CASCADE ni tiklash
-- ==========================================================
-- 202607210000_initial_schema.sql `users` jadvalini
--   id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
-- deb e'lon qiladi, va `staff` da ham xuddi shunday. Lekin prod'da
-- `users_id_fkey` qachondir NO ACTION ga o'zgarib qolgan (drift) —
-- ehtimol erta `db push` konstraintni qayta yaratganida. Natijada
-- Supabase Auth'dan foydalanuvchi o'chirilsa, `public.users` qatori
-- yetim bo'lib qoladi (staff to'g'ri cascade bo'ladi).
--
-- public.users(id) ga ishora qiluvchi barcha jadvallar
-- (ariza_signatures, attendance_records, student_telegram_links)
-- allaqachon ON DELETE CASCADE — shuning uchun cascade'ni yoqish xavfsiz.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users
  ADD CONSTRAINT users_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
