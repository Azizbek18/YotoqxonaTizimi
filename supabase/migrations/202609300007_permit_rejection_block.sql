-- ==========================================================
-- Yo'llanma: 2-marta rad → avtomatik blok
-- ==========================================================
-- Dekan yo'llanmani rad etganda `rejection_count` oshadi. 2 ga yetganda
-- `blocked = true` bo'ladi — o'sha pasport/JSHSHIR bilan (yo'llanma yoki
-- imtiyozli) yangi ariza yuborib bo'lmaydi (lib/permit-resubmission.ts
-- 'blocked' natijasi). Blokni dekan/superadmin qo'lda yechadi (blocked=false,
-- rejection_count=0). `block_notified_at` — blokdagi odam qayta uringanda
-- yuboriladigan yakuniy rad xabari uchun 24 soatlik anti-spam throttle.
--
-- permit_requests da passport_series / jshshir / email UNIQUE — bitta odam =
-- bitta qator, shuning uchun alohida blocklist jadvali kerak emas.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS. Mavjud rad etilgan qatorlar
-- bloklanmaydi — hisob 0 dan boshlanadi, faqat bundan keyingi rad etishlar.

ALTER TABLE public.permit_requests
  ADD COLUMN IF NOT EXISTS rejection_count   integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blocked           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked_at        timestamptz,
  ADD COLUMN IF NOT EXISTS block_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS permit_requests_blocked_idx
  ON public.permit_requests (blocked) WHERE blocked;

COMMENT ON COLUMN public.permit_requests.rejection_count IS
  'Dekan necha marta rad etgan. 2 ga yetganda blocked=true.';
COMMENT ON COLUMN public.permit_requests.blocked IS
  'true → bu pasport/JSHSHIR bilan yangi ariza yuborib bo''lmaydi. Dekan/superadmin qo''lda yechadi.';
