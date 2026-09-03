-- ==========================================================
-- Avtomatik Ariza + Tilxat: elektron imzo va yetkazib berish
-- ==========================================================
-- Arizachi (yo'llanma yoki imtiyozli) endi Ariza va Tilxatni yuklab
-- olmaydi, chop etmaydi va dekanga qo'lda olib bormaydi. U yo'llanma
-- yuborish vaqtida bir marta imzo chizadi. Dekan xona biriktirgach, tizim
-- ikkala imzo (talaba + dekan), xona, sana va Ariza № bilan to'ldirilgan
-- PDF ni server tomonda yaratadi va arizachining Telegramiga (ulangan
-- bo'lsa) yoki emailiga yuboradi.
--
--   * staff.signature_image — dekanning bir marta chizadigan imzosi
--     (/dekan/sozlamalar). Har hujjatga avtomatik bosiladi.
--   * permit_documents — bitta arizaga bitta hujjat holati: talaba imzosi
--     (submit vaqtida), dekan imzosi + xona + yetkazib berish holati
--     (xona biriktirilgach). delivered_at bir marta yoziladi — idempotent.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS signature_image text;

COMMENT ON COLUMN public.staff.signature_image IS
  'Dekanning qo''lda chizilgan elektron imzosi (PNG data URL). Ariza/Tilxat PDF ga avtomatik bosiladi.';

CREATE TABLE IF NOT EXISTS public.permit_documents (
  permit_request_id  uuid PRIMARY KEY REFERENCES public.permit_requests(id) ON DELETE CASCADE,

  -- Talaba tomoni — ariza yuborish vaqtida to'ldiriladi.
  student_signature  text NOT NULL,               -- trimmed PNG data URL
  student_signed_at  timestamptz NOT NULL DEFAULT now(),
  student_ip         text,
  student_user_agent text,

  -- Dekan tomoni + xona — xona biriktirilgach to'ldiriladi.
  dekan_staff_id     uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  dekan_name         text,
  dekan_signature    text,
  ariza_no           text,
  assigned_floor     integer,
  assigned_room      text,

  -- Yetkazib berish — bir marta.
  pdf_path           text,                         -- `permits` bucket ichidagi yo'l
  delivered_at       timestamptz,
  delivery_channel   text CHECK (delivery_channel IN ('telegram', 'email')),
  delivery_error     text,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS permit_documents_undelivered_idx
  ON public.permit_documents (permit_request_id)
  WHERE delivered_at IS NULL;

ALTER TABLE public.permit_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permit_documents FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.permit_documents FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.permit_documents TO service_role;

COMMENT ON TABLE public.permit_documents IS
  'Bir arizaning imzolangan Ariza+Tilxat hujjati: talaba imzosi (submit), dekan imzosi+xona (biriktirishda), yetkazib berish holati. Server-only.';
