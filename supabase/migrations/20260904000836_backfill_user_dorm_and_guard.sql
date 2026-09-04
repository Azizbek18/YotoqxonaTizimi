-- ==========================================================
-- Xonasi bor talabaning dorm_id si to'ldirilsin va kafolatlansin
-- ==========================================================
-- MUAMMO: `app/api/student/register` INSERT `dorm_id` ni umuman yozmagan,
-- `activate_pending_student` ham faqat room_number NULL bo'lganda ko'chirgan.
-- Natijada 26 joylashgan talabadan 24 tasi `users.dorm_id = NULL`. Xona
-- raqamlari ("1","12","23"…) har yotoqxonada takrorlangani uchun bunday talaba
-- occupancy/xonadosh/dekan-xaritada 6 yotoqxona bo'ylab "tarqoq" ko'rinadi.
--
-- Bu migratsiya: (1) mavjud NULL qatorlarni backfill qiladi, (2) bundan keyin
-- "xonasi bor lekin yotoqxonasi yo'q" holatni trigger bilan bloklaydi.

-- ---------------------------------------------------------------------
-- 1. Backfill — avval mos tasdiqlangan permitdan
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_from_permit int;
  v_from_faculty int;
  v_still_null int;
BEGIN
  UPDATE public.users u
  SET dorm_id = pr.dorm_id, updated_at = now()
  FROM public.permit_requests pr
  WHERE u.role = 'talaba'
    AND u.room_number IS NOT NULL
    AND u.dorm_id IS NULL
    AND pr.dorm_id IS NOT NULL
    AND pr.status IN ('approved', 'registered')
    AND pr.passport_series = u.passport_series
    AND (
      (pr.jshshir IS NOT NULL AND u.jshshir = pr.jshshir)
      OR (pr.jshshir IS NULL AND u.jshshir IS NULL)
    );
  GET DIAGNOSTICS v_from_permit = ROW_COUNT;

  -- 2. Qolganlari — fakultet yotoqxonasidan (202609160000 backfill kabi)
  UPDATE public.users u
  SET dorm_id = fd.dorm_id, updated_at = now()
  FROM public.faculty_dorm fd
  WHERE u.role = 'talaba'
    AND u.room_number IS NOT NULL
    AND u.dorm_id IS NULL
    AND fd.faculty = COALESCE(NULLIF(TRIM(u.faculty), ''), 'amit');
  GET DIAGNOSTICS v_from_faculty = ROW_COUNT;

  -- permit_requests ham (approved/registered, xonasi bor, dormsiz)
  UPDATE public.permit_requests pr
  SET dorm_id = fd.dorm_id, updated_at = now()
  FROM public.faculty_dorm fd
  WHERE pr.status IN ('approved', 'registered')
    AND pr.room_number IS NOT NULL
    AND pr.dorm_id IS NULL
    AND fd.faculty = COALESCE(NULLIF(TRIM(pr.faculty), ''), 'amit');

  SELECT count(*) INTO v_still_null
  FROM public.users
  WHERE role = 'talaba' AND room_number IS NOT NULL AND dorm_id IS NULL;

  RAISE NOTICE 'dorm_id backfill: % from permit, % from faculty_dorm, % still NULL',
    v_from_permit, v_from_faculty, v_still_null;
END $$;

-- ---------------------------------------------------------------------
-- 3. Trigger — "xonasi bor lekin yotoqxonasi yo'q" ni bloklash
-- ---------------------------------------------------------------------
-- CHECK constraint emas: (a) mavjud NULL qator qolgan bo'lsa jadval buzilmasin,
-- (b) haqiqiy NOT NULL PR 5 da, hamma yozuvchi dorm_id yozganiga ishonch hosil
-- qilingach keladi. RPClarning room+dorm bitta UPDATE'i muammosiz o'tadi.
CREATE OR REPLACE FUNCTION public.enforce_dorm_id_when_roomed()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.room_number IS NOT NULL AND NEW.dorm_id IS NULL THEN
    -- INSERT'da doim, UPDATE'da faqat shu ikki maydondan biri o'zgarganda
    IF TG_OP = 'INSERT'
       OR NEW.room_number IS DISTINCT FROM OLD.room_number
       OR NEW.dorm_id IS DISTINCT FROM OLD.dorm_id THEN
      RAISE EXCEPTION 'Xonasi bor talabaning/arizaning yotoqxonasi (dorm_id) belgilanishi shart'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_users_dorm_when_roomed ON public.users;
CREATE TRIGGER trg_users_dorm_when_roomed
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.enforce_dorm_id_when_roomed();

DROP TRIGGER IF EXISTS trg_permit_requests_dorm_when_roomed ON public.permit_requests;
CREATE TRIGGER trg_permit_requests_dorm_when_roomed
  BEFORE INSERT OR UPDATE ON public.permit_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_dorm_id_when_roomed();
