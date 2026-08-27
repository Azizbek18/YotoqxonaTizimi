-- One-off TEST DATA for verifying the "navbatdagi o'rningiz" (queue
-- position) feature — not a migration, not meant to stay in the DB.
-- Run in Supabase Studio SQL Editor.
--
-- Inserts 3 'pending' permit_requests for the same faculty ('amit', to
-- match the dekan account already used for testing), with staggered
-- created_at so they have a real, deterministic queue order. The third
-- one is the one to actually check — it should come back as "3 / 3".
INSERT INTO permit_requests
  (passport_series, jshshir, full_name, email, phone, gender, faculty, direction, course, permit_url, status, created_at)
VALUES
  ('TS1000001', '10000000000001', 'Navbat Sinov Birinchi', 'navbat.test1@example.com', '+998900000101', 'male', 'amit', 'Amaliy matematika', 1, 'test/navbat-test-1.pdf', 'pending', now() - interval '10 minutes'),
  ('TS1000002', '10000000000002', 'Navbat Sinov Ikkinchi', 'navbat.test2@example.com', '+998900000102', 'male', 'amit', 'Amaliy matematika', 1, 'test/navbat-test-2.pdf', 'pending', now() - interval '5 minutes'),
  ('TS1000003', '10000000000003', 'Navbat Sinov Uchinchi', 'navbat.test3@example.com', '+998900000103', 'male', 'amit', 'Amaliy matematika', 1, 'test/navbat-test-3.pdf', 'pending', now());

-- Tekshirish uchun (masalan /ruxsatnoma-tekshirish yoki bosh sahifada):
--   Pasport: TS1000003
--   JSHSHIR: 10000000000003
--   Email:   navbat.test3@example.com
-- Kutilgan natija: "3 / 3" (o'zidan oldin 2 ta pending ariza bor).

-- Sinovdan so'ng tozalash uchun (shu skriptni SQL Editor'da alohida
-- ishga tushiring):
-- DELETE FROM permit_requests WHERE passport_series IN ('TS1000001', 'TS1000002', 'TS1000003');
