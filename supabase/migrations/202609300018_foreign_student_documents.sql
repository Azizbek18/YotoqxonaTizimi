-- ==========================================================
-- Xorijiy talaba — viza va yashash joyida ro'yxatga qo'yish (propiska) nazorati
-- ==========================================================
-- O'zbekistonda o'qiydigan chet el fuqarosi ikki hujjatni amalda tutishi
-- shart: VIZA (har o'quv yili yangilanadi) va YASHASH JOYIDA RO'YXATGA
-- QO'YISH / propiska (mehmonxona / ijara / qarindosh uyi / yotoqxona). Har
-- ikkalasining muddati tugaydi; kechiktirish talabaga jarima va deportatsiya
-- xavfini, universitetга HEMIS oldida javobgarlikni keltiradi.
--
--   * foreign_student_documents — bir talabaga bir yoki bir nechta hujjat
--     yozuvi (viza + propiska, tarixi bilan). `expires_on` — sanoq va
--     eslatmalar shu ustundan hisoblanadi.
--   * foreign_document_reminders — idempotentlik jurnali. Kunlik cron
--     eslatma yuborishdan oldin (document_id, milestone) qatorini
--     `on conflict do nothing` bilan yozadi, shunda har bosqich aynan bir
--     marta ketadi (cron ikki marta ishlasa ham).
--
-- Kirish faqat server (API route + guard) orqali — permit_documents dagidek
-- service_role only, RLS FORCE.

CREATE TABLE IF NOT EXISTS public.foreign_student_documents (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  doc_type           text NOT NULL CHECK (doc_type IN ('visa', 'registration')),
  number             text,                       -- viza raqami (propiskada ham viza raqami)
  issued_on          date,
  expires_on         date NOT NULL,
  status             text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'renewing', 'cancelled')),

  -- Faqat doc_type = 'registration' uchun.
  registration_basis text CHECK (registration_basis IN ('mehmonxona', 'ijara', 'qarindosh', 'ttj')),
  address            text,

  file_path          text,                       -- `permits` bucket ichida foreign-docs/<student_id>/<uuid>.<ext>
  note               text,

  -- Dekanning ixtiyoriy tasdig'i (majburiy gate emas).
  verified_at        timestamptz,
  verified_by        uuid REFERENCES public.staff(id) ON DELETE SET NULL,

  created_by_role    text NOT NULL DEFAULT 'talaba'
                       CHECK (created_by_role IN ('talaba', 'dekan', 'admin')),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS foreign_student_documents_student_idx
  ON public.foreign_student_documents (student_id, doc_type);

CREATE INDEX IF NOT EXISTS foreign_student_documents_active_expiry_idx
  ON public.foreign_student_documents (expires_on)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS public.foreign_document_reminders (
  document_id  uuid NOT NULL REFERENCES public.foreign_student_documents(id) ON DELETE CASCADE,
  milestone    integer NOT NULL,   -- 30/15/10/5/3/0 ; manfiy = muddat o'tgandan keyingi N-kun
  sent_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, milestone)
);

ALTER TABLE public.foreign_student_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foreign_student_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE public.foreign_document_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foreign_document_reminders FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.foreign_student_documents FROM anon, authenticated;
REVOKE ALL ON TABLE public.foreign_document_reminders FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.foreign_student_documents TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.foreign_document_reminders TO service_role;

COMMENT ON TABLE public.foreign_student_documents IS
  'Xorijiy talabaning viza / propiska yozuvlari (tarixi bilan). expires_on — sanoq va eslatma manbai. Server-only.';
COMMENT ON TABLE public.foreign_document_reminders IS
  'Eslatma idempotentlik jurnali: (document_id, milestone) bir marta. Kunlik cron on-conflict-do-nothing bilan yozadi.';
