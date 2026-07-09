-- ==========================================================
-- TUZATISH: "elonlar" jadvalidagi audience CHECK cheklovi
-- Ushbu skriptni Supabase SQL Editor'da ishga tushiring.
--
-- Muammo: Sardor (qavat sardori) "Navbatchilik jadvali"ni saqlaganda
-- (app/sardor/dashboard/page.tsx -> handleSaveDuty) doim xatolik
-- bilan tugaydi:
--   {"code":"23514", "message":"new row for relation \"elonlar\"
--   violates check constraint \"elonlar_audience_check\""}
--
-- Sabab: jadval ma'lumotlari (haftalik navbatchilar) chindan ham e'lon
-- emas, "elonlar" jadvalida shunchaki JSON saqlash uchun qatordan
-- foydalaniladi, va u talabalarga umumiy e'lonlar ro'yxatida
-- ko'rinmasligi uchun ataylab audience='internal' bilan yoziladi
-- (/api/elonlar faqat 'all'/'faculty'/'floor' qiymatlarini ko'rsatadi,
-- shuning uchun bu tanlov to'g'ri). Lekin bazadagi CHECK cheklovi
-- faqat ('all', 'faculty', 'floor')ni ruxsat etadi — 'internal' hech
-- qachon qo'shilmagan, shuning uchun saqlash doim rad etilardi.
-- ==========================================================

ALTER TABLE elonlar DROP CONSTRAINT IF EXISTS elonlar_audience_check;
ALTER TABLE elonlar ADD CONSTRAINT elonlar_audience_check
CHECK (audience IN ('all', 'faculty', 'floor', 'internal'));
