-- ==========================================================
-- Bosqich 1e — cleaning_schedule fakultet bo'yicha
-- ==========================================================
-- Per-xona tozalik navbati jadvali. Xona raqami endi faqat bir fakultet
-- binosi ichida yagona, shuning uchun kalit ham (faculty, room_number)
-- bo'ladi.
--
-- RLS o'zgarmaydi: 202607290000 dan keyin bu jadvalda policy yo'q
-- (faqat service-role tegadi). features/duty/server/repository.ts upsert'ni
-- (faculty, room_number) bo'yicha qiladi.

ALTER TABLE cleaning_schedule ADD COLUMN IF NOT EXISTS faculty text NOT NULL DEFAULT 'amit';

-- `room_number text PRIMARY KEY` inline -> avtomatik nom cleaning_schedule_pkey.
ALTER TABLE cleaning_schedule DROP CONSTRAINT IF EXISTS cleaning_schedule_pkey;
ALTER TABLE cleaning_schedule ADD PRIMARY KEY (faculty, room_number);
