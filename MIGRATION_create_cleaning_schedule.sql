-- ==========================================================
-- cleaning_schedule JADVALINI YARATISH
-- Ushbu skriptni Supabase SQL Editor'da ishga tushiring.
--
-- Muammo: "Tozalik Navbatchiligi" (xona ichidagi navbatchilik jadvali)
-- funksiyasi uchun kerakli "cleaning_schedule" jadvali production
-- bazada mavjud emas edi (DATABASE_SCHEMA.sql'dagi
-- 014_create_cleaning_schedule.sql migratsiyasi ishga tushirilmagan
-- ko'rinadi). Natijada har bir "saqlash" faqat brauzerning
-- localStorage'iga yozilib, xonadoshlar bir-birining jadval
-- o'zgartirishlarini ko'rmas edi (haqiqiy sinxronizatsiya yo'q edi).
-- ==========================================================

CREATE TABLE IF NOT EXISTS cleaning_schedule (
    room_number text PRIMARY KEY,
    schedule jsonb NOT NULL,
    updated_at timestamptz DEFAULT NOW()
);

ALTER TABLE cleaning_schedule ENABLE ROW LEVEL SECURITY;

-- Har kim (jumladan tizimga kirmagan foydalanuvchi ham) jadvalni o'qiy oladi
CREATE POLICY "Allow public read access" ON cleaning_schedule
    FOR SELECT TO public USING (true);

-- Tizimga kirgan har qanday foydalanuvchi jadval qo'sha/yangilay oladi
-- (xona raqami bo'yicha cheklov yo'q — DATABASE_SCHEMA.sql'dagi asl
-- dizaynga mos, xavfsizlik darajasi past xavfli ma'lumot uchun yetarli
-- deb hisoblangan)
CREATE POLICY "Allow authenticated insert/update" ON cleaning_schedule
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tekshiruv: jadval yaratilganini tasdiqlaydi
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'cleaning_schedule';
