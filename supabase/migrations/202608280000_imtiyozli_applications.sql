-- Not every student can get a "yo'llanma" (referral) from my.gov.uz — foreign
-- students and privileged categories (orphans, disabled, low-income family)
-- don't have one at all. For them the university accepts a signed "Ariza"
-- (application) + "Tilxat" (pledge) instead, backed by a passport photo
-- rather than an AI-verified referral document. Both request types land in
-- the same dekan queue (permit_requests) so the review/approve/room-assign
-- flow stays unified — only application_type tells them apart.
--
-- jshshir (Uzbekistan's national ID number) genuinely doesn't exist for a
-- foreign applicant, so it must become optional. passport_series stays
-- NOT NULL for both types — for 'imtiyozli' it just holds whatever
-- passport/ID number the student typed, unvalidated against the Uzbek
-- AA1234567 format (that check lives in application code, not here).
ALTER TABLE public.permit_requests
  ALTER COLUMN jshshir DROP NOT NULL;

ALTER TABLE public.permit_requests
  ADD COLUMN IF NOT EXISTS application_type text NOT NULL DEFAULT 'yollanma',
  ADD COLUMN IF NOT EXISTS relative_phone text,
  ADD COLUMN IF NOT EXISTS origin_country text,
  ADD COLUMN IF NOT EXISTS origin_region text,
  ADD COLUMN IF NOT EXISTS study_type text;

ALTER TABLE public.permit_requests
  DROP CONSTRAINT IF EXISTS permit_requests_application_type_check;
ALTER TABLE public.permit_requests
  ADD CONSTRAINT permit_requests_application_type_check
  CHECK (application_type IN ('yollanma', 'imtiyozli'));

ALTER TABLE public.permit_requests
  DROP CONSTRAINT IF EXISTS permit_requests_study_type_check;
ALTER TABLE public.permit_requests
  ADD CONSTRAINT permit_requests_study_type_check
  CHECK (study_type IS NULL OR study_type IN ('grant', 'kontrakt'));

COMMENT ON COLUMN public.permit_requests.application_type IS
  'yollanma = government referral (my.gov.uz), imtiyozli = foreign/privileged student submitting Ariza+Tilxat+passport photo instead.';
COMMENT ON COLUMN public.permit_requests.jshshir IS
  'Uzbekistan national ID number. NULL for application_type = imtiyozli (foreign applicants have none).';
