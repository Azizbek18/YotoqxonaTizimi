-- ==========================================================
-- E'lon auditoriyasi: 'system' (butun tizim bo'ylab)
-- ==========================================================
-- Shu paytgacha eng keng auditoriya 'all' edi, lekin har bino bitta
-- fakultetга tegishli bo'lgach 'all' ham amalда bitta fakultet bilan
-- cheklandi (features/announcements/server/service.ts sameFacultyCode).
--
-- Superadmin butun universitet bo'ylab bitta e'lon chiqara olishi kerak.
-- Buning uchun yangi auditoriya: 'system' — fakultет/qavат/jinsга qaramay
-- HAR bir talabага ko'rinadi (service.ts listForUser: audience='system' -> true).
--
-- elonlar.faculty NOT NULL (202609080000) — 'system' qatorlar DEFAULT 'amit'
-- bilan saqlanadi, lekin bu qiymat filtrда e'tiborsiz qoldiriladi.
--
-- Migratsiya idempotent: DROP ... IF EXISTS + ADD — qayta ishlansa ham
-- xatosiz. Mavjud qatorlar tekshiruvni buzmaydi (faqat yangi qiymat
-- qo'shilyapti).

ALTER TABLE public.elonlar DROP CONSTRAINT IF EXISTS elonlar_audience_check;

ALTER TABLE public.elonlar ADD CONSTRAINT elonlar_audience_check
  CHECK (audience IN ('all', 'faculty', 'floor', 'internal', 'system'));
