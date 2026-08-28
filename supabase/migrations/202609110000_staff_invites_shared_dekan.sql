-- ==========================================================
-- Bitta umumiy dekan ro'yxatdan o'tish linki
-- ==========================================================
-- Ilgari har fakultet uchun alohida dekan kodi kerak edi. Endi tizim egasi
-- BITTA kod yaratadi (scripts/mint-dekan-invite.mjs --shared) va uni barcha
-- dekanlarga yuboradi. Dekan /register/dekan da fakultetini o'zi tanlaydi.
--
-- faculty = NULL bo'lsa — "ro'yxatdan o'tuvchi fakultetni formada tanlaydi".
-- Fakultetli kodlar (tarbiyachi) o'zgarishsiz ishlaydi.
ALTER TABLE public.staff_invites ALTER COLUMN faculty DROP NOT NULL;

-- Har fakultetda faqat bitta faol dekan. Umumiy link kim kodni bilsa
-- ro'yxatdan o'tishga ruxsat beradi — aynan shu indeks ikkinchi odam
-- band fakultetni egallab olishini to'sadi. Ro'yxatdan o'tish route'i ham
-- oldindan tekshiradi (yaxshi xato xabari uchun), bu esa poyga holatini
-- (ikki kishi bir vaqtda) qat'iy bloklaydi.
CREATE UNIQUE INDEX IF NOT EXISTS staff_one_active_dekan_per_faculty
  ON public.staff (lower(faculty))
  WHERE role = 'dekan' AND status = 'active';
