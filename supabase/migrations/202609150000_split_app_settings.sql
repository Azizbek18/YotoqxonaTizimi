-- ==========================================================
-- P2 — app_settings: to'lov summasi fakultetда, qolgani dorms da
-- ==========================================================
-- Fizik + kontakt sozlamalar P0 da dorms ga ko'chirilgan. Endi ularni
-- app_settings dan olib tashlaymiz. app_settings faqat:
--   faculty (PK) · monthly_fee · yearly_contract_fee · updated_at
--
-- Bino sozlamalari (sig'im, qavatlar, TTJ nomi, kontaktlar) endi dorms
-- dan o'qiladi (faculty_dorm orqali). features/app-settings ni ikki
-- manbadan yig'ib beradigan qilib qayta yozdik — AppSettings DTO
-- o'zgarmaydi, shuning uchun ~25 chaqiruvchi tegilmaydi.
--
-- DROP COLUMN qaytarilmaydi — lekin ma'lumot dorms da (P0 nusxa oldi),
-- va bu migratsiya P0 dan keyin darhol ishlaydi, orasida tahrir yo'q.

-- 1. Ishonch uchun: har biriktirilgan binoni app_settings dan qayta
--    sinxronlaymiz (bir bino ko'p fakultetga tegishli bo'lsa — eng oxirgi
--    tahrirlangani g'olib).
UPDATE public.dorms d
SET
  default_room_capacity = s.default_room_capacity,
  floor_count = s.floor_count,
  tarbiyachi_name = s.tarbiyachi_name,
  tarbiyachi_phone = s.tarbiyachi_phone,
  komendant_name = s.komendant_name,
  komendant_phone = s.komendant_phone,
  doctor_name = s.doctor_name,
  doctor_phone = s.doctor_phone,
  talaba_kengashi_raisi_ogil_name = s.talaba_kengashi_raisi_ogil_name,
  talaba_kengashi_raisi_ogil_phone = s.talaba_kengashi_raisi_ogil_phone,
  talaba_kengashi_raisi_qiz_name = s.talaba_kengashi_raisi_qiz_name,
  talaba_kengashi_raisi_qiz_phone = s.talaba_kengashi_raisi_qiz_phone,
  security_phone = s.security_phone,
  max_upload_size_mb = s.max_upload_size_mb,
  warning_threshold = s.warning_threshold,
  ttj_name = s.ttj_name,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (fd.dorm_id)
    fd.dorm_id, a.*
  FROM public.faculty_dorm fd
  JOIN public.app_settings a ON a.faculty = fd.faculty
  ORDER BY fd.dorm_id, a.updated_at DESC
) s
WHERE d.id = s.dorm_id;

-- 2. Fizik/kontakt ustunlarni app_settings dan olib tashlaymiz.
--    Ularга bog'langan CHECK cheklovlar ustun bilan birga o'chadi.
ALTER TABLE public.app_settings
  DROP COLUMN IF EXISTS default_room_capacity,
  DROP COLUMN IF EXISTS floor_count,
  DROP COLUMN IF EXISTS tarbiyachi_name,
  DROP COLUMN IF EXISTS tarbiyachi_phone,
  DROP COLUMN IF EXISTS komendant_name,
  DROP COLUMN IF EXISTS komendant_phone,
  DROP COLUMN IF EXISTS doctor_name,
  DROP COLUMN IF EXISTS doctor_phone,
  DROP COLUMN IF EXISTS talaba_kengashi_raisi_ogil_name,
  DROP COLUMN IF EXISTS talaba_kengashi_raisi_ogil_phone,
  DROP COLUMN IF EXISTS talaba_kengashi_raisi_qiz_name,
  DROP COLUMN IF EXISTS talaba_kengashi_raisi_qiz_phone,
  DROP COLUMN IF EXISTS security_phone,
  DROP COLUMN IF EXISTS max_upload_size_mb,
  DROP COLUMN IF EXISTS warning_threshold,
  DROP COLUMN IF EXISTS ttj_name;
