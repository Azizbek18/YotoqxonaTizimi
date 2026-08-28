-- ==========================================================
-- Bosqich 1d (1/2) — fakultetlararo xona biriktirishlarini tozalash
-- ==========================================================
-- Yangi model: talabaning yotoqxona binosi = uning akademik fakulteti
-- (`users.faculty`), doim. Har fakultet o'z binosiga ega.
--
-- Hozircha faqat AMIT binosi mavjud (`floor_room_layout.faculty = 'amit'`),
-- lekin ba'zi non-AMIT talabalar shu binoning xonalariga biriktirilgan
-- (eski oqimlar, permit oldindan-biriktirish, admin qo'lda tahriri orqali).
-- Keyingi migratsiya (202609030001) xona sig'imi/jins tekshiruvini fakultet
-- bo'yicha cheklaydi — o'sha paytda bunday "begona binodagi" talaba
-- ko'rinmay qoladi va jismoniy xona ortiqcha band bo'lishi mumkin.
--
-- Shuning uchun ular AVVAL "xonasiz" navbatga qaytariladi: o'z fakulteti
-- ishga tushib, o'z binosini qurgach, o'sha fakultet dekani ularni
-- joylashtiradi.
--
-- ⚠️ Bu qatorlar sonini production'da oldindan tekshiring:
--   SELECT count(*) FROM users
--   WHERE role = 'talaba' AND room_number IS NOT NULL
--     AND lower(coalesce(faculty, '')) NOT IN ('amit', '');
--   SELECT count(*) FROM permit_requests
--   WHERE status = 'approved' AND room_number IS NOT NULL
--     AND lower(coalesce(faculty, '')) NOT IN ('amit', '');

-- Faculty'si bo'sh yoki 'amit' bo'lmagan talabalarning xonasi tozalanadi.
-- is_floor_captain ham tushiriladi — qavatsiz sardorlik ma'nosiz
-- (features/room-assignment/server/repository.ts -> clearStudentRoom bilan
-- bir xil mantiq).
UPDATE public.users
SET room_number = NULL,
    assigned_floor = NULL,
    is_floor_captain = false
WHERE role = 'talaba'
  AND room_number IS NOT NULL
  AND lower(coalesce(faculty, '')) NOT IN ('amit', '');

-- Non-AMIT tasdiqlangan yo'llanmalarning oldindan biriktirilgan xonasi ham
-- tozalanadi (ular ham "xonasiz" navbatning bir qismi).
UPDATE public.permit_requests
SET room_number = NULL
WHERE status = 'approved'
  AND room_number IS NOT NULL
  AND lower(coalesce(faculty, '')) NOT IN ('amit', '');
