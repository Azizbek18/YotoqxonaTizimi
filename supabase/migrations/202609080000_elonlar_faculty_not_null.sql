-- ==========================================================
-- Bosqich 4 — har bir e'lon aniq bitta fakultetga tegishli
-- ==========================================================
-- Shu paytgacha audience = 'all' e'lonlar faculty = NULL bilan saqlanardi va
-- talabaning e'lonlar lentasi (features/announcements/server/service.ts,
-- listForUser) ularni HAR fakultet talabasiga ko'rsatardi. Bir bino sharoitida
-- bu sezilmasdi; ko'p fakultetli tizimda bu fakultetlararo ma'lumot sizishi:
-- fizika dekani "barchaga" deb yozgan e'lon amit talabalariga ham yetadi.
--
-- Quyida:
--   * mavjud faculty'siz qatorlar birlamchi binoga ('amit') biriktiriladi
--     (1f allaqachon 'floor' va navbatchilik qatorlarini backfill qilgan —
--      bu yerda asosan eski audience = 'all' qatorlar qoladi)
--   * faculty ustuni majburiy bo'ladi (DEFAULT 'amit'), shunda kelgusi insert
--     faculty'siz, tenant'lararo e'lonni qayta kirita olmaydi
-- audience = 'all' qiymati saqlanadi: u endi "shu fakultet binosidagi barcha"
-- degani (talaba UI'sidagi "Yotoqxona" bo'limi), lekin o'qishda ham fakultet
-- bo'yicha filtrlanadi.

UPDATE public.elonlar
SET faculty = 'amit'
WHERE faculty IS NULL;

ALTER TABLE public.elonlar ALTER COLUMN faculty SET DEFAULT 'amit';
ALTER TABLE public.elonlar ALTER COLUMN faculty SET NOT NULL;
