-- ==========================================================
-- P0 — Shared dorm tenancy: yotoqxona qobig'i + fakultet xaritasi
-- ==========================================================
-- Bitta yotoqxona binosida bir nechta fakultet yashashi mumkin bo'ladi
-- (masalan AMIT + Taekvondo). Fakultet / dekan / talaba alohida qoladi —
-- faqat bino umumiy. Bino QAVATLAR bo'yicha bo'linadi va bo'linish ikki
-- dekan o'rtasida kelishiladi (P1).
--
-- Bu migratsiya FAQAT sxemani qo'yadi — xatti-harakat o'zgarmaydi. Hech
-- qanday kod hali `dorms` / `faculty_dorm` / `dorm_floor` ni yoki yangi
-- `dorm_id` ustunlarini o'qimaydi; hamma joy hamon `faculty` ni ishlatadi.
-- To'liq reja: https://claude.ai/code/artifact/abdee3c8-1065-4b46-ad6c-77de82844da3
--
-- Idempotent: IF NOT EXISTS / ON CONFLICT DO NOTHING / NOT EXISTS bilan
-- qayta ishga tushirilsa 0 o'zgarish.

-- ----------------------------------------------------------
-- 1. dorms — bino qobig'i (fizik + kontakt sozlamalar; to'lov summasi EMAS)
-- ----------------------------------------------------------
-- app_settings dagi fizik/kontakt ustunlar shu yerga ko'chadi (P2 da
-- app_settings dan olib tashlanadi). monthly_fee / yearly_contract_fee
-- fakultetда qoladi (operator qarori 2026-08-29).
CREATE TABLE IF NOT EXISTS public.dorms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number        text NOT NULL,
  name          text NOT NULL DEFAULT '',
  address       text NOT NULL DEFAULT '',
  default_room_capacity int NOT NULL DEFAULT 4 CHECK (default_room_capacity > 0),
  floor_count   int NOT NULL DEFAULT 5 CHECK (floor_count > 0),
  tarbiyachi_name  text NOT NULL DEFAULT '',
  tarbiyachi_phone text NOT NULL DEFAULT '',
  komendant_name   text NOT NULL DEFAULT '',
  komendant_phone  text NOT NULL DEFAULT '',
  doctor_name      text NOT NULL DEFAULT '',
  doctor_phone     text NOT NULL DEFAULT '',
  talaba_kengashi_raisi_ogil_name  text NOT NULL DEFAULT '',
  talaba_kengashi_raisi_ogil_phone text NOT NULL DEFAULT '',
  talaba_kengashi_raisi_qiz_name   text NOT NULL DEFAULT '',
  talaba_kengashi_raisi_qiz_phone  text NOT NULL DEFAULT '',
  security_phone      text NOT NULL DEFAULT '',
  max_upload_size_mb int NOT NULL DEFAULT 5 CHECK (max_upload_size_mb > 0),
  warning_threshold  int NOT NULL DEFAULT 2 CHECK (warning_threshold > 0),
  ttj_name      text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Yotoqxona raqami bino identifikatori — dekan ro'yxatdan o'tishda kiritadi.
-- Bo'sh joy / registrga sezgir emas.
CREATE UNIQUE INDEX IF NOT EXISTS dorms_number_key
  ON public.dorms (lower(trim(number)));

ALTER TABLE public.dorms ENABLE ROW LEVEL SECURITY;
-- Mijozga ochiq policy yo'q — faqat service-role (dekan/superadmin API'lari).

-- ----------------------------------------------------------
-- 2. faculty_dorm — fakultet qaysi binoda (1:1)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.faculty_dorm (
  faculty     text PRIMARY KEY,
  dorm_id     uuid NOT NULL REFERENCES public.dorms(id) ON DELETE RESTRICT,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS faculty_dorm_dorm_idx ON public.faculty_dorm (dorm_id);

ALTER TABLE public.faculty_dorm ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------
-- 3. dorm_floor — qavat taqsimoti (tasdiqlangan egalik)
-- ----------------------------------------------------------
-- Har qavat butunligicha bitta fakultetniki. Taklif/kelishuv mexanizmi
-- (pending_faculty, rad etish va h.k.) P1 da qo'shiladi — bu yerda faqat
-- tasdiqlangan holat saqlanadi.
CREATE TABLE IF NOT EXISTS public.dorm_floor (
  dorm_id       uuid NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
  floor_number  int  NOT NULL CHECK (floor_number >= 1),
  faculty       text NOT NULL,
  confirmed_by  uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  confirmed_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dorm_id, floor_number)
);
CREATE INDEX IF NOT EXISTS dorm_floor_dorm_faculty_idx
  ON public.dorm_floor (dorm_id, faculty);

ALTER TABLE public.dorm_floor ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------
-- 4. dorm_id ustunlari (nullable — hozircha hech kim o'qimaydi)
-- ----------------------------------------------------------
ALTER TABLE public.staff             ADD COLUMN IF NOT EXISTS dorm_id uuid REFERENCES public.dorms(id) ON DELETE SET NULL;
ALTER TABLE public.floor_room_layout ADD COLUMN IF NOT EXISTS dorm_id uuid REFERENCES public.dorms(id) ON DELETE SET NULL;
ALTER TABLE public.users             ADD COLUMN IF NOT EXISTS dorm_id uuid REFERENCES public.dorms(id) ON DELETE SET NULL;
ALTER TABLE public.permit_requests   ADD COLUMN IF NOT EXISTS dorm_id uuid REFERENCES public.dorms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS floor_room_layout_dorm_idx ON public.floor_room_layout (dorm_id);
CREATE INDEX IF NOT EXISTS users_dorm_idx             ON public.users (dorm_id) WHERE dorm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS permit_requests_dorm_idx   ON public.permit_requests (dorm_id) WHERE dorm_id IS NOT NULL;

-- ----------------------------------------------------------
-- 5. Seed — hozirgi AMIT binosi = 1-yotoqxona
-- ----------------------------------------------------------
-- app_settings.amit qatoridan ko'chiramiz. Faqat baza dorms bo'sh bo'lsa.
INSERT INTO public.dorms (
  number, name,
  default_room_capacity, floor_count,
  tarbiyachi_name, tarbiyachi_phone, komendant_name, komendant_phone,
  doctor_name, doctor_phone,
  talaba_kengashi_raisi_ogil_name, talaba_kengashi_raisi_ogil_phone,
  talaba_kengashi_raisi_qiz_name, talaba_kengashi_raisi_qiz_phone,
  security_phone, max_upload_size_mb, warning_threshold, ttj_name
)
SELECT
  '1', 'Asosiy bino',
  s.default_room_capacity, s.floor_count,
  s.tarbiyachi_name, s.tarbiyachi_phone, s.komendant_name, s.komendant_phone,
  s.doctor_name, s.doctor_phone,
  s.talaba_kengashi_raisi_ogil_name, s.talaba_kengashi_raisi_ogil_phone,
  s.talaba_kengashi_raisi_qiz_name, s.talaba_kengashi_raisi_qiz_phone,
  s.security_phone, s.max_upload_size_mb, s.warning_threshold, s.ttj_name
FROM public.app_settings s
WHERE s.faculty = 'amit'
  AND NOT EXISTS (SELECT 1 FROM public.dorms);

-- Bo'sh baza (app_settings.amit ham yo'q) — sof default bino.
INSERT INTO public.dorms (number, name)
SELECT '1', 'Asosiy bino'
WHERE NOT EXISTS (SELECT 1 FROM public.dorms);

-- AMIT -> 1-bino.
INSERT INTO public.faculty_dorm (faculty, dorm_id)
SELECT 'amit', d.id
FROM public.dorms d
WHERE d.number = '1'
ON CONFLICT (faculty) DO NOTHING;

-- Mavjud AMIT qavatlari — generate_series(1..floor_count) + tarxda ishlatilgan
-- qavatlar birlashmasi — hammasi AMIT ga tasdiqlangan (hozir yagona fakultet).
INSERT INTO public.dorm_floor (dorm_id, floor_number, faculty)
SELECT fd.dorm_id, f.floor_number, 'amit'
FROM public.faculty_dorm fd
CROSS JOIN LATERAL (
  SELECT g AS floor_number
  FROM public.dorms d, generate_series(1, d.floor_count) AS g
  WHERE d.id = fd.dorm_id
  UNION
  SELECT DISTINCT l.floor_number
  FROM public.floor_room_layout l
  WHERE l.floor_number >= 1
    AND coalesce(nullif(trim(l.faculty), ''), 'amit') = 'amit'
) f
WHERE fd.faculty = 'amit'
ON CONFLICT (dorm_id, floor_number) DO NOTHING;

-- ----------------------------------------------------------
-- 6. Backfill dorm_id — AMIT ga tegishli qatorlar
-- ----------------------------------------------------------
UPDATE public.staff s
SET dorm_id = fd.dorm_id
FROM public.faculty_dorm fd
WHERE fd.faculty = 'amit'
  AND s.dorm_id IS NULL
  AND coalesce(nullif(trim(s.faculty), ''), 'amit') = 'amit';

UPDATE public.floor_room_layout l
SET dorm_id = fd.dorm_id
FROM public.faculty_dorm fd
WHERE fd.faculty = 'amit'
  AND l.dorm_id IS NULL
  AND coalesce(nullif(trim(l.faculty), ''), 'amit') = 'amit';

UPDATE public.users u
SET dorm_id = fd.dorm_id
FROM public.faculty_dorm fd
WHERE fd.faculty = 'amit'
  AND u.dorm_id IS NULL
  AND u.role = 'talaba'
  AND u.room_number IS NOT NULL
  AND coalesce(nullif(trim(u.faculty), ''), 'amit') = 'amit';

UPDATE public.permit_requests p
SET dorm_id = fd.dorm_id
FROM public.faculty_dorm fd
WHERE fd.faculty = 'amit'
  AND p.dorm_id IS NULL
  AND p.room_number IS NOT NULL
  AND coalesce(nullif(trim(p.faculty), ''), 'amit') = 'amit';
