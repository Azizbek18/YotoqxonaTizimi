-- ==========================================================
-- Bosqich 1b — app_settings fakultet bo'yicha
-- ==========================================================
-- Ilgari `app_settings` bitta qatorli edi (id = 1 CHECK bilan qulflangan).
-- Endi har fakultet o'z binosining sozlamalariga ega: oylik/yillik to'lov,
-- qavatlar soni, xona sig'imi, komendant/shifokor/xavfsizlik telefonlari,
-- TTJ nomi.
--
-- Mavjud yagona qator AMIT binosiga tegishli (Bosqich 1 tanlovi) — u
-- `faculty = 'amit'` bo'ladi. Yangi fakultet ishga tushganda uning qatori
-- alohida yaratiladi (Bosqich 3). Fakultet qatori bo'lmaganda kod hozircha
-- 'amit' qatoriga qaytadi (features/app-settings/server/repository.ts).

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS faculty text;
UPDATE app_settings SET faculty = 'amit' WHERE faculty IS NULL;
ALTER TABLE app_settings ALTER COLUMN faculty SET NOT NULL;

-- Bitta-qator qulfini olib tashlaymiz: id = 1 CHECK va id ustidagi PK
-- (ikkalasi ham `id int PRIMARY KEY DEFAULT 1 CHECK (id = 1)` inline
-- ta'rifidan avtomatik nomlangan).
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_id_check;
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE app_settings ADD PRIMARY KEY (faculty);
ALTER TABLE app_settings DROP COLUMN IF EXISTS id;

-- RLS o'zgarmaydi: mijozga ochiq policy yo'q, faqat service-role kaliti
-- (/api/settings o'qish, /api/dekan/settings dekan yozishi) tegadi.
