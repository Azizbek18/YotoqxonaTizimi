-- Bir yo'nalish ikki xil yozuvda saqlanib qolgan: yo'llanma formasi
-- (ruxsatnoma-yuborish) `direction` maydonini erkin matn sifatida olgan
-- ("Amaliy matematika"), ro'yxatdan o'tish formasi esa select qiymatini
-- ("amaliy-matematika") yozgan. app/api/student/register users.direction ni
-- to'g'ridan-to'g'ri permit_requests.direction dan ko'chiradi, shuning uchun
-- ikkala variant ham talaba yozuvlariga tarqalgan. Natijada bitta yo'nalish
-- hisobot filtrlarida, guruhlashda va eksportda ikkita alohida yo'nalish
-- bo'lib ko'ringan.
--
-- Endi barcha kiritish nuqtalari select (lib/directions.ts) — bu migratsiya
-- esa mavjud yozuvlarni o'sha kanonik qiymatlarga keltiradi.
--
-- Solishtirish kaliti: harf va raqamdan boshqa hamma narsa olib tashlanadi,
-- so'ng kichik harfga o'tkaziladi. Shunda "amaliy-matematika", "Amaliy
-- matematika" va "Amaliy  Matematika" bir xil kalitga tushadi; o'zbekcha
-- apostroflar ham ("Sun'iy intellekt" / "suniy-intellekt") shu yo'l bilan
-- tenglashadi. lib/directions.ts dagi directionKey() aynan shu qoidani
-- ishlatadi -- baza, server va klient bir xil narsani "bir xil yo'nalish"
-- deb hisoblashi uchun.
--
-- Ro'yxatda tanilmagan qiymatlar o'z holicha qoladi: hech narsa jimgina
-- yo'qolmaydi, ular UIda xom matn sifatida ko'rinib turaveradi.
CREATE OR REPLACE FUNCTION pg_temp.direction_key(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$ SELECT lower(regexp_replace(coalesce(p_value, ''), '[^a-zA-Z0-9]+', '', 'g')) $$;

WITH canon(canonical, match_key) AS (
  VALUES
    ('amaliy-matematika', 'amaliymatematika'),
    ('matematik-tahlil', 'matematiktahlil'),
    ('funksional-tahlil', 'funksionaltahlil'),
    ('differensial-tenglamalar', 'differensialtenglamalar'),
    ('dasturiy-injiniring', 'dasturiyinjiniring'),
    ('kompyuter-ilmlari', 'kompyuterilmlari'),
    ('kompyuter-tarmoqlari', 'kompyutertarmoqlari'),
    ('suniy-intellekt', 'suniyintellekt'),
    ('axborot-xavfsizligi', 'axborotxavfsizligi'),
    ('kiberxavfsizlik', 'kiberxavfsizlik'),
    ('raqamli-forensika', 'raqamliforensika'),
    ('uzbekiston-tarixi', 'uzbekistontarixi'),
    ('uzbekiston-tarixi', 'ozbekistontarixi'),
    ('jahon-tarixi', 'jahontarixi'),
    ('arxeologiya', 'arxeologiya'),
    ('nazariy-fizika', 'nazariyfizika'),
    ('atom-fizikasi', 'atomfizikasi'),
    ('atom-fizikasi', 'atomvamolekulyarfizika'),
    ('energetika', 'energetika'),
    ('organik-kimyo', 'organikkimyo'),
    ('analitik-kimyo', 'analitikkimyo'),
    ('noorganik-kimyo', 'noorganikkimyo'),
    ('genetika', 'genetika'),
    ('mikrobiologiya', 'mikrobiologiya'),
    ('biotexnologiya', 'biotexnologiya'),
    ('geologiya-umumiy', 'geologiyaumumiy'),
    ('geologiya-umumiy', 'umumiygeologiya'),
    ('kon-geologiyasi', 'kongeologiyasi'),
    ('gidrogeologiya', 'gidrogeologiya'),
    ('geoekologiya', 'geoekologiya'),
    ('geoinformatika', 'geoinformatika'),
    ('turizm', 'turizm'),
    ('sotsiologiya', 'sotsiologiya'),
    ('psixologiya', 'psixologiya'),
    ('falsafa', 'falsafa'),
    ('fuqarolik-huquqi', 'fuqarolikhuquqi'),
    ('jinoyat-huquqi', 'jinoyathuquqi'),
    ('xalqaro-huquq', 'xalqarohuquq'),
    ('iqtisodiyot', 'iqtisodiyot'),
    ('moliya', 'moliya'),
    ('menejment', 'menejment'),
    ('marketing', 'marketing'),
    ('ozbek-filologiyasi', 'ozbekfilologiyasi'),
    ('ozbek-tilshunosligi', 'ozbektilshunosligi'),
    ('adabiyotshunoslik', 'adabiyotshunoslik'),
    ('ingliz-filologiyasi', 'inglizfilologiyasi'),
    ('nemis-filologiyasi', 'nemisfilologiyasi'),
    ('fransuz-filologiyasi', 'fransuzfilologiyasi'),
    ('televideniye', 'televideniye'),
    ('radio', 'radio'),
    ('radio', 'radiojurnalistikasi'),
    ('multimedia', 'multimedia'),
    ('multimedia', 'multimediajurnalistikasi'),
    ('arabshunoslik', 'arabshunoslik'),
    ('xitoyshunoslik', 'xitoyshunoslik'),
    ('turkshunoslik', 'turkshunoslik')
)
UPDATE public.permit_requests p
SET direction = c.canonical
FROM canon c
WHERE p.direction IS NOT NULL
  AND pg_temp.direction_key(p.direction) = c.match_key
  AND p.direction <> c.canonical;

WITH canon(canonical, match_key) AS (
  VALUES
    ('amaliy-matematika', 'amaliymatematika'),
    ('matematik-tahlil', 'matematiktahlil'),
    ('funksional-tahlil', 'funksionaltahlil'),
    ('differensial-tenglamalar', 'differensialtenglamalar'),
    ('dasturiy-injiniring', 'dasturiyinjiniring'),
    ('kompyuter-ilmlari', 'kompyuterilmlari'),
    ('kompyuter-tarmoqlari', 'kompyutertarmoqlari'),
    ('suniy-intellekt', 'suniyintellekt'),
    ('axborot-xavfsizligi', 'axborotxavfsizligi'),
    ('kiberxavfsizlik', 'kiberxavfsizlik'),
    ('raqamli-forensika', 'raqamliforensika'),
    ('uzbekiston-tarixi', 'uzbekistontarixi'),
    ('uzbekiston-tarixi', 'ozbekistontarixi'),
    ('jahon-tarixi', 'jahontarixi'),
    ('arxeologiya', 'arxeologiya'),
    ('nazariy-fizika', 'nazariyfizika'),
    ('atom-fizikasi', 'atomfizikasi'),
    ('atom-fizikasi', 'atomvamolekulyarfizika'),
    ('energetika', 'energetika'),
    ('organik-kimyo', 'organikkimyo'),
    ('analitik-kimyo', 'analitikkimyo'),
    ('noorganik-kimyo', 'noorganikkimyo'),
    ('genetika', 'genetika'),
    ('mikrobiologiya', 'mikrobiologiya'),
    ('biotexnologiya', 'biotexnologiya'),
    ('geologiya-umumiy', 'geologiyaumumiy'),
    ('geologiya-umumiy', 'umumiygeologiya'),
    ('kon-geologiyasi', 'kongeologiyasi'),
    ('gidrogeologiya', 'gidrogeologiya'),
    ('geoekologiya', 'geoekologiya'),
    ('geoinformatika', 'geoinformatika'),
    ('turizm', 'turizm'),
    ('sotsiologiya', 'sotsiologiya'),
    ('psixologiya', 'psixologiya'),
    ('falsafa', 'falsafa'),
    ('fuqarolik-huquqi', 'fuqarolikhuquqi'),
    ('jinoyat-huquqi', 'jinoyathuquqi'),
    ('xalqaro-huquq', 'xalqarohuquq'),
    ('iqtisodiyot', 'iqtisodiyot'),
    ('moliya', 'moliya'),
    ('menejment', 'menejment'),
    ('marketing', 'marketing'),
    ('ozbek-filologiyasi', 'ozbekfilologiyasi'),
    ('ozbek-tilshunosligi', 'ozbektilshunosligi'),
    ('adabiyotshunoslik', 'adabiyotshunoslik'),
    ('ingliz-filologiyasi', 'inglizfilologiyasi'),
    ('nemis-filologiyasi', 'nemisfilologiyasi'),
    ('fransuz-filologiyasi', 'fransuzfilologiyasi'),
    ('televideniye', 'televideniye'),
    ('radio', 'radio'),
    ('radio', 'radiojurnalistikasi'),
    ('multimedia', 'multimedia'),
    ('multimedia', 'multimediajurnalistikasi'),
    ('arabshunoslik', 'arabshunoslik'),
    ('xitoyshunoslik', 'xitoyshunoslik'),
    ('turkshunoslik', 'turkshunoslik')
)
UPDATE public.users u
SET direction = c.canonical
FROM canon c
WHERE u.direction IS NOT NULL
  AND pg_temp.direction_key(u.direction) = c.match_key
  AND u.direction <> c.canonical;

WITH canon(canonical, match_key) AS (
  VALUES
    ('amaliy-matematika', 'amaliymatematika'),
    ('matematik-tahlil', 'matematiktahlil'),
    ('funksional-tahlil', 'funksionaltahlil'),
    ('differensial-tenglamalar', 'differensialtenglamalar'),
    ('dasturiy-injiniring', 'dasturiyinjiniring'),
    ('kompyuter-ilmlari', 'kompyuterilmlari'),
    ('kompyuter-tarmoqlari', 'kompyutertarmoqlari'),
    ('suniy-intellekt', 'suniyintellekt'),
    ('axborot-xavfsizligi', 'axborotxavfsizligi'),
    ('kiberxavfsizlik', 'kiberxavfsizlik'),
    ('raqamli-forensika', 'raqamliforensika'),
    ('uzbekiston-tarixi', 'uzbekistontarixi'),
    ('uzbekiston-tarixi', 'ozbekistontarixi'),
    ('jahon-tarixi', 'jahontarixi'),
    ('arxeologiya', 'arxeologiya'),
    ('nazariy-fizika', 'nazariyfizika'),
    ('atom-fizikasi', 'atomfizikasi'),
    ('atom-fizikasi', 'atomvamolekulyarfizika'),
    ('energetika', 'energetika'),
    ('organik-kimyo', 'organikkimyo'),
    ('analitik-kimyo', 'analitikkimyo'),
    ('noorganik-kimyo', 'noorganikkimyo'),
    ('genetika', 'genetika'),
    ('mikrobiologiya', 'mikrobiologiya'),
    ('biotexnologiya', 'biotexnologiya'),
    ('geologiya-umumiy', 'geologiyaumumiy'),
    ('geologiya-umumiy', 'umumiygeologiya'),
    ('kon-geologiyasi', 'kongeologiyasi'),
    ('gidrogeologiya', 'gidrogeologiya'),
    ('geoekologiya', 'geoekologiya'),
    ('geoinformatika', 'geoinformatika'),
    ('turizm', 'turizm'),
    ('sotsiologiya', 'sotsiologiya'),
    ('psixologiya', 'psixologiya'),
    ('falsafa', 'falsafa'),
    ('fuqarolik-huquqi', 'fuqarolikhuquqi'),
    ('jinoyat-huquqi', 'jinoyathuquqi'),
    ('xalqaro-huquq', 'xalqarohuquq'),
    ('iqtisodiyot', 'iqtisodiyot'),
    ('moliya', 'moliya'),
    ('menejment', 'menejment'),
    ('marketing', 'marketing'),
    ('ozbek-filologiyasi', 'ozbekfilologiyasi'),
    ('ozbek-tilshunosligi', 'ozbektilshunosligi'),
    ('adabiyotshunoslik', 'adabiyotshunoslik'),
    ('ingliz-filologiyasi', 'inglizfilologiyasi'),
    ('nemis-filologiyasi', 'nemisfilologiyasi'),
    ('fransuz-filologiyasi', 'fransuzfilologiyasi'),
    ('televideniye', 'televideniye'),
    ('radio', 'radio'),
    ('radio', 'radiojurnalistikasi'),
    ('multimedia', 'multimedia'),
    ('multimedia', 'multimediajurnalistikasi'),
    ('arabshunoslik', 'arabshunoslik'),
    ('xitoyshunoslik', 'xitoyshunoslik'),
    ('turkshunoslik', 'turkshunoslik')
)
UPDATE public.arizalar a
SET direction = c.canonical
FROM canon c
WHERE a.direction IS NOT NULL
  AND pg_temp.direction_key(a.direction) = c.match_key
  AND a.direction <> c.canonical;
