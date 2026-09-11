-- O'zbekiston fuqarosi bo'lgan, lekin doimiy ro'yxatga olingan viloyati
-- yotoqxona joylashgan hududdan farq qiladigan talaba ham qonun bo'yicha
-- vaqtinchalik turar joyda ro'yxatga qo'yilishi (propiska) shart —
-- xorijiy talabadagi kabi VIZA emas, faqat `foreign_student_documents`
-- jadvalidagi 'registration' turi. Kim "mahalliy" (propiska shart emas)
-- ekanini aniqlash uchun dekan shu binoning "uy" hudud(lar)ini ko'rsatadi;
-- vergul bilan ajratilgan viloyat nomlari (public/data/uz-address.json
-- dagi `regions[].name` bilan aynan mos kelishi kerak, masalan
-- "Toshkent shahri, Toshkent viloyati"). Bo'sh — sozlanmagan, shu bino
-- uchun propiska kengaytmasi o'chirilgan hisoblanadi
-- (features/foreign-docs/domain/eligibility.ts).
--
-- Boshqa fizik/kontakt sozlamalar kabi (202609150000) bu ham bino
-- darajasida — `dorms`da, `app_settings`da emas.
ALTER TABLE public.dorms
  ADD COLUMN IF NOT EXISTS home_regions text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.dorms.home_regions IS
  'Vergul bilan ajratilgan "mahalliy" viloyat nomlari (uz-address regions bilan mos) — shu ro''yxatdagi viloyatdan bo''lmagan O''zbekiston fuqarosi talaba ham propiska (registration) moduliga ega bo''ladi. Bo''sh = kengaytma o''chiq.';
