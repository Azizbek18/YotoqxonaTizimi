-- ==========================================================
-- Test talaba akkauntlarini olib tashlash (operator tasdig'i, 2026-08-28)
-- ==========================================================
-- Fakultet migratsiyasidan OLDIN ishlaydi (fayl nomi eng kichik). Preflight:
-- AMIT binosida xonasi bor, fakulteti 'amit' bo'lmagan 12 ta talaba bor edi —
-- hammasi test uchun kiritilgan (bitta tester bir necha marta), operator
-- o'chirishni tasdiqladi. Ular o'chmasa 202609030000 ularning xonasini bo'shatib,
-- keyin ham "xonasiz" bo'lib turaverardi.
--
-- public.users.id -> auth.users.id FK jonli bazada ON DELETE CASCADE'siz
-- (schema drift), shuning uchun bolalar -> public.users -> auth.users tartibida.
-- Idempotent: boshqa bazada mos qator bo'lmasa 0 qator o'chadi.

CREATE TEMP TABLE _del_test_students ON COMMIT DROP AS
SELECT id, passport_series, jshshir
FROM public.users
WHERE role = 'talaba'
  AND room_number IS NOT NULL
  AND lower(trim(coalesce(faculty, 'amit'))) <> 'amit';

DELETE FROM public.arizalar                WHERE student_id IN (SELECT id FROM _del_test_students);
DELETE FROM public.tolovlar                WHERE student_id IN (SELECT id FROM _del_test_students);
DELETE FROM public.payment_receipt_uploads WHERE student_id IN (SELECT id FROM _del_test_students);
DELETE FROM public.profiles               WHERE id IN (SELECT id FROM _del_test_students);
DELETE FROM public.permit_requests p
  USING _del_test_students d
  WHERE p.passport_series = d.passport_series AND p.jshshir = d.jshshir;
DELETE FROM public.users                  WHERE id IN (SELECT id FROM _del_test_students);
DELETE FROM auth.users                    WHERE id IN (SELECT id FROM _del_test_students);
