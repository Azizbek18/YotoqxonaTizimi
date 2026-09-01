-- AI degradatsiya belgisi. Barcha AI provayderlar (Groq / AI Gateway / Gemini)
-- bir vaqtda limit/billing sabab ishlamay qolganda, talaba oqimlari xatosiz
-- davom etadi va hujjat/chek "manual" deb belgilanadi — dekan yoki tarbiyachi
-- uni qo'lda diqqat bilan ko'rib chiqadi. AI ishlаб "noto'g'ri" degan holat
-- bundan farqli: u avvalgidek bloklanadi va bu yerga umuman yetib kelmaydi.
--   passed  = AI hujjat/chekni tekshirdi (odatiy holat)
--   manual  = AI band edi, xodim qo'lda ko'rsin
--   skipped = AI bu tur uchun qo'llanmaydi (imtiyozli ariza — rasmiy namuna yo'q)

ALTER TABLE public.permit_requests
  ADD COLUMN IF NOT EXISTS ai_review text NOT NULL DEFAULT 'passed'
  CONSTRAINT permit_requests_ai_review_check CHECK (ai_review IN ('passed', 'manual', 'skipped'));

ALTER TABLE public.tolovlar
  ADD COLUMN IF NOT EXISTS ai_review text NOT NULL DEFAULT 'passed'
  CONSTRAINT tolovlar_ai_review_check CHECK (ai_review IN ('passed', 'manual', 'skipped'));

COMMENT ON COLUMN public.permit_requests.ai_review IS
  'passed = AI hujjatni tekshirdi; manual = AI band edi, xodim qo''lda ko''rsin; skipped = AI qo''llanmaydi (imtiyozli)';
COMMENT ON COLUMN public.tolovlar.ai_review IS
  'passed = AI chekni tekshirdi; manual = AI band edi, tarbiyachi qo''lda ko''rsin';
