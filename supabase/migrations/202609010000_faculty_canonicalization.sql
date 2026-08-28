-- ==========================================================
-- Fakultet kodlarini kanonik holatga keltirish
-- ==========================================================
-- Tizim ilgari bitta fakultet uchun mo'ljallangan edi; endi lib/faculties.ts
-- O'zMU'ning to'liq 13 ta fakultetini o'z ichiga oladi (manba: nuu.uz,
-- 2026-08-28). Kodlar `amit`, `fizika`, `kimyo`, `tarix`, `biologiya`
-- o'zgarmadi — ular bo'yicha hech narsa ko'chirilmaydi.
--
-- Bu migratsiya faqat ERKIN yozilgan / eski imlodagi `faculty` qiymatlarini
-- ("AMIT", "Amaliy matematika", "Biologiya va ekologiya") kanonik kodga
-- keltiradi. Solishtirish kaliti 202607300001 dagi bilan bir xil: harf va
-- raqamdan boshqa hamma narsa olib tashlanadi, so'ng kichik harf.
-- lib/faculties.ts dagi FACULTY_ALIASES aynan shu jadvalni takrorlaydi.
--
-- Tanilmagan qiymatlar o'z holicha qoladi — UIda xom matn ko'rinib
-- turaveradi, jimgina yo'qolmaydi.
--
-- `direction` qiymatlari ATAYLAB tegilmaydi: fakultet endi taklif qilmaydigan
-- yo'nalishlar lib/directions.ts dagi LEGACY_DIRECTIONS orqali hamon
-- o'qiladigan matn sifatida ko'rsatiladi.

CREATE OR REPLACE FUNCTION pg_temp.faculty_key(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT lower(regexp_replace(coalesce(p_value, ''), '[^a-zA-Z0-9]+', '', 'g')) $$;

-- users
WITH canon(canonical, match_key) AS (
  VALUES
    ('amit', 'amit'),
    ('amit', 'amaliymatematikavaintellektualtexnologiyalar'),
    ('amit', 'amaliymatematika'),
    ('matematika', 'matematika'),
    ('fizika', 'fizika'),
    ('kimyo', 'kimyo'),
    ('biologiya', 'biologiya'),
    ('biologiya', 'biologiyavaekologiya'),
    ('geologiya', 'geologiya'),
    ('geologiya', 'geologiyavamuhandislikgeologiyasi'),
    ('geografiya', 'geografiya'),
    ('geografiya', 'geografiyavageoaxborottizimlari'),
    ('iqtisodiyot', 'iqtisodiyot'),
    ('tarix', 'tarix'),
    ('ijtimoiy-fanlar', 'ijtimoiyfanlar'),
    ('xorijiy-filologiya', 'xorijiyfilologiya'),
    ('ozbek-filologiyasi', 'ozbekfilologiyasi'),
    ('ozbek-filologiyasi', 'jurnalistikavaozbekfilologiyasi'),
    ('ozbek-filologiyasi', 'jurnalistika'),
    ('sport', 'sport'),
    ('sport', 'taekvondo'),
    ('sport', 'taekvondovasportfaoliyati')
)
UPDATE public.users t
SET faculty = c.canonical
FROM canon c
WHERE t.faculty IS NOT NULL
  AND pg_temp.faculty_key(t.faculty) = c.match_key
  AND t.faculty <> c.canonical;

-- staff (dekan fakultet biriktirilishi)
WITH canon(canonical, match_key) AS (
  VALUES
    ('amit', 'amit'),
    ('amit', 'amaliymatematikavaintellektualtexnologiyalar'),
    ('amit', 'amaliymatematika'),
    ('matematika', 'matematika'),
    ('fizika', 'fizika'),
    ('kimyo', 'kimyo'),
    ('biologiya', 'biologiya'),
    ('biologiya', 'biologiyavaekologiya'),
    ('geologiya', 'geologiya'),
    ('geologiya', 'geologiyavamuhandislikgeologiyasi'),
    ('geografiya', 'geografiya'),
    ('geografiya', 'geografiyavageoaxborottizimlari'),
    ('iqtisodiyot', 'iqtisodiyot'),
    ('tarix', 'tarix'),
    ('ijtimoiy-fanlar', 'ijtimoiyfanlar'),
    ('xorijiy-filologiya', 'xorijiyfilologiya'),
    ('ozbek-filologiyasi', 'ozbekfilologiyasi'),
    ('ozbek-filologiyasi', 'jurnalistikavaozbekfilologiyasi'),
    ('ozbek-filologiyasi', 'jurnalistika'),
    ('sport', 'sport'),
    ('sport', 'taekvondo'),
    ('sport', 'taekvondovasportfaoliyati')
)
UPDATE public.staff t
SET faculty = c.canonical
FROM canon c
WHERE t.faculty IS NOT NULL
  AND pg_temp.faculty_key(t.faculty) = c.match_key
  AND t.faculty <> c.canonical;

-- permit_requests (yo'llanma / imtiyozli arizalar)
WITH canon(canonical, match_key) AS (
  VALUES
    ('amit', 'amit'),
    ('amit', 'amaliymatematikavaintellektualtexnologiyalar'),
    ('amit', 'amaliymatematika'),
    ('matematika', 'matematika'),
    ('fizika', 'fizika'),
    ('kimyo', 'kimyo'),
    ('biologiya', 'biologiya'),
    ('biologiya', 'biologiyavaekologiya'),
    ('geologiya', 'geologiya'),
    ('geologiya', 'geologiyavamuhandislikgeologiyasi'),
    ('geografiya', 'geografiya'),
    ('geografiya', 'geografiyavageoaxborottizimlari'),
    ('iqtisodiyot', 'iqtisodiyot'),
    ('tarix', 'tarix'),
    ('ijtimoiy-fanlar', 'ijtimoiyfanlar'),
    ('xorijiy-filologiya', 'xorijiyfilologiya'),
    ('ozbek-filologiyasi', 'ozbekfilologiyasi'),
    ('ozbek-filologiyasi', 'jurnalistikavaozbekfilologiyasi'),
    ('ozbek-filologiyasi', 'jurnalistika'),
    ('sport', 'sport'),
    ('sport', 'taekvondo'),
    ('sport', 'taekvondovasportfaoliyati')
)
UPDATE public.permit_requests t
SET faculty = c.canonical
FROM canon c
WHERE t.faculty IS NOT NULL
  AND pg_temp.faculty_key(t.faculty) = c.match_key
  AND t.faculty <> c.canonical;

-- elonlar (fakultetga yo'naltirilgan e'lonlar)
WITH canon(canonical, match_key) AS (
  VALUES
    ('amit', 'amit'),
    ('amit', 'amaliymatematikavaintellektualtexnologiyalar'),
    ('amit', 'amaliymatematika'),
    ('matematika', 'matematika'),
    ('fizika', 'fizika'),
    ('kimyo', 'kimyo'),
    ('biologiya', 'biologiya'),
    ('biologiya', 'biologiyavaekologiya'),
    ('geologiya', 'geologiya'),
    ('geologiya', 'geologiyavamuhandislikgeologiyasi'),
    ('geografiya', 'geografiya'),
    ('geografiya', 'geografiyavageoaxborottizimlari'),
    ('iqtisodiyot', 'iqtisodiyot'),
    ('tarix', 'tarix'),
    ('ijtimoiy-fanlar', 'ijtimoiyfanlar'),
    ('xorijiy-filologiya', 'xorijiyfilologiya'),
    ('ozbek-filologiyasi', 'ozbekfilologiyasi'),
    ('ozbek-filologiyasi', 'jurnalistikavaozbekfilologiyasi'),
    ('ozbek-filologiyasi', 'jurnalistika'),
    ('sport', 'sport'),
    ('sport', 'taekvondo'),
    ('sport', 'taekvondovasportfaoliyati')
)
UPDATE public.elonlar t
SET faculty = c.canonical
FROM canon c
WHERE t.faculty IS NOT NULL
  AND pg_temp.faculty_key(t.faculty) = c.match_key
  AND t.faculty <> c.canonical;
