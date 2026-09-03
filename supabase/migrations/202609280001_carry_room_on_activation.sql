-- ==========================================================
-- Biriktirilgan xonani 'pending' talabaga ko'chirish
-- ==========================================================
-- MUAMMO: registratsiya sehrgari qayta ishlangach, talaba permit `approved`
-- bo'lishi bilan `/register` ga yo'naltiriladi va darhol ro'yxatdan o'tadi —
-- ya'ni "xona biriktirilishidan OLDIN ro'yxatdan o'tish" endi ODATIY holat.
--
-- Bugun xona faqat `app/api/student/register` dagi INSERT orqali
-- `permit_requests` -> `users` ga ko'chadi (o'sha ham xona register vaqtida
-- bo'lsa). `assign_permit_room_atomic` faqat `permit_requests.room_number` ni
-- yozadi; `activate_pending_student` esa xonani `users` ga umuman ko'chirmaydi.
-- Natijada: talaba ro'yxatdan o'tib faollashadi -> keyin dekan xona beradi ->
-- `users.room_number` NULL bo'lib qoladi, dashboardда xona ko'rinmaydi.
--
-- TUZATISH (2 funksiya, ikkalasi ham prod'dagi joriy tanadan olinib, oxiriga
-- 'pending'/xonasiz `users` qatoriga ko'chirish qo'shilgan):
--   1. assign_permit_room_atomic — permitga xona yozgach, mos 'pending' users
--      qatorini ham darhol yangilaydi.
--   2. activate_pending_student — faollashtirishda, agar users.room_number NULL
--      va permitda xona bo'lsa, room_number + assigned_floor + dorm_id ni
--      ko'chiradi. Har talaba o'tadigan yagona nuqta — asosiy himoya shu.
--
-- (Kelib chiqishi: fix/room-carryover-pending-students branchидаги e033792.
--  U branch main'ga merge qilinmagan; bu yerda faqat 2 funksiya tanasi joriy
--  prod sxemaga moslab ko'chirildi. Backfill migratsiyasi + dekan-navbat UI
--  o'zgarishlari o'sha branchning alohida reconcile'ida qoladi.)

-- ---------------------------------------------------------------------
-- assign_permit_room_atomic — joriy prod tana + 'pending' akkauntga ko'chirish
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_permit_room_atomic(
  p_permit_id uuid, p_room_number text, p_max_capacity integer DEFAULT 4
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_faculty text; v_gender text; v_row_dorm uuid; v_dorm_id uuid;
  v_floor int; v_floor_owner text; v_df_found boolean;
  v_frozen boolean; v_room_capacity smallint; v_room_gender text; v_occupied int; v_conflicting int;
BEGIN
  SELECT COALESCE(NULLIF(faculty, ''), 'amit'), dorm_id INTO v_faculty, v_row_dorm
  FROM public.permit_requests WHERE id = p_permit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permit not approved' USING ERRCODE = 'P0005'; END IF;

  v_dorm_id := COALESCE(v_row_dorm, (SELECT dorm_id FROM public.faculty_dorm WHERE faculty = v_faculty));
  IF v_dorm_id IS NULL THEN RAISE EXCEPTION 'No dorm for faculty %', v_faculty USING ERRCODE = 'P0002'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_dorm_id::text || ':' || p_room_number));

  SELECT floor_number, frozen, capacity, gender INTO v_floor, v_frozen, v_room_capacity, v_room_gender
  FROM public.floor_room_layout
  WHERE dorm_id = v_dorm_id AND room_number = p_room_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002'; END IF;
  IF v_frozen THEN RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004'; END IF;

  SELECT faculty INTO v_floor_owner FROM public.dorm_floor
  WHERE dorm_id = v_dorm_id AND floor_number = v_floor;
  v_df_found := FOUND;
  IF v_df_found AND v_floor_owner IS DISTINCT FROM v_faculty THEN
    RAISE EXCEPTION 'Room is on another faculty''s floor' USING ERRCODE = 'P0007';
  END IF;

  SELECT gender INTO v_gender FROM public.permit_requests
  WHERE id = p_permit_id AND status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permit not approved' USING ERRCODE = 'P0005'; END IF;

  IF v_room_gender IS NOT NULL AND v_gender IS NOT NULL AND v_room_gender <> v_gender THEN
    RAISE EXCEPTION 'Room reserved for other gender' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users
    WHERE role = 'talaba' AND room_number = p_room_number AND (dorm_id = v_dorm_id OR dorm_id IS NULL)
    UNION ALL
    SELECT pr.id FROM public.permit_requests pr
    WHERE pr.status = 'approved' AND pr.room_number = p_room_number
      AND (pr.dorm_id = v_dorm_id OR pr.dorm_id IS NULL) AND pr.id <> p_permit_id
      AND NOT EXISTS (
        -- Once the applicant has an account, that `users` row is the truth
        -- about where they live — the permit's room_number is a spent
        -- reservation (and may even point at a room they were later moved
        -- out of). Match on passport / JSHSHIR, both unique per person.
        SELECT 1 FROM public.users u
        WHERE u.role = 'talaba'
          AND (
            (u.passport_series IS NOT NULL AND u.passport_series = pr.passport_series)
            OR (u.jshshir IS NOT NULL AND pr.jshshir IS NOT NULL AND u.jshshir = pr.jshshir)
          )
      )
  ) occupants;
  IF v_occupied >= COALESCE(v_room_capacity, p_max_capacity) THEN
    RAISE EXCEPTION 'Room is full' USING ERRCODE = 'P0001';
  END IF;

  IF v_gender IS NOT NULL THEN
    SELECT count(*) INTO v_conflicting FROM (
      SELECT gender FROM public.users
      WHERE role = 'talaba' AND room_number = p_room_number
        AND (dorm_id = v_dorm_id OR dorm_id IS NULL) AND gender IS NOT NULL
      UNION ALL
      SELECT gender FROM public.permit_requests
      WHERE status = 'approved' AND room_number = p_room_number
        AND (dorm_id = v_dorm_id OR dorm_id IS NULL) AND id <> p_permit_id AND gender IS NOT NULL
    ) g WHERE g.gender <> v_gender;
    IF v_conflicting > 0 THEN RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001'; END IF;
  END IF;

  UPDATE public.permit_requests
  SET room_number = p_room_number, dorm_id = v_dorm_id, updated_at = now()
  WHERE id = p_permit_id AND status = 'approved';

  -- Xonani darhol mos 'pending' (email tasdiqlanmagan / hali faollashmagan)
  -- akkauntga ham ko'chiramiz. Bo'lmasa talaba faollashgunча xona ko'rinmaydi
  -- va dekan bitta odamni ikki joyda (permit + user) ko'radi.
  UPDATE public.users u
  SET room_number = p_room_number,
      dorm_id = v_dorm_id,
      assigned_floor = v_floor,
      updated_at = now()
  FROM public.permit_requests pr
  WHERE pr.id = p_permit_id
    AND u.role = 'talaba'
    AND u.status = 'pending'
    AND u.room_number IS NULL
    AND u.passport_series = pr.passport_series
    AND lower(trim(u.email)) = lower(trim(pr.email))
    AND (
      (pr.jshshir IS NOT NULL AND u.jshshir = pr.jshshir)
      OR (pr.jshshir IS NULL AND u.jshshir IS NULL)
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) TO service_role;

-- ---------------------------------------------------------------------
-- activate_pending_student — joriy prod tana + faollashtirishda xona ko'chirish
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_pending_student(
  p_user_id uuid,
  p_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_passport text;
  v_jshshir text;
  v_permit_id uuid;
BEGIN
  IF p_user_id IS NULL
     OR p_email IS NULL
     OR length(trim(p_email)) < 3
     OR length(p_email) > 254 THEN
    RETURN false;
  END IF;

  SELECT passport_series, jshshir
  INTO v_passport, v_jshshir
  FROM public.users
  WHERE id = p_user_id
    AND role = 'talaba'
    AND status = 'pending'
    AND lower(trim(email)) = lower(trim(p_email))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT id
  INTO v_permit_id
  FROM public.permit_requests
  WHERE passport_series = v_passport
    AND (
      (v_jshshir IS NOT NULL AND jshshir = v_jshshir AND application_type = 'yollanma')
      OR
      (v_jshshir IS NULL AND jshshir IS NULL AND application_type = 'imtiyozli')
    )
    AND lower(trim(email)) = lower(trim(p_email))
    AND status = 'approved'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.users
  SET status = 'active',
      updated_at = now()
  WHERE id = p_user_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Dekan xonani permit qatoriga biriktirgan bo'lsa (talaba 'pending' ekan)
  -- va assign_permit_room_atomic uni hali ko'chirmagan bo'lsa — endi ko'chiramiz.
  -- Faqat akkauntda xona bo'lmasa.
  UPDATE public.users u
  SET room_number = pr.room_number,
      dorm_id = COALESCE(pr.dorm_id, u.dorm_id),
      assigned_floor = COALESCE(
        (SELECT f.floor_number FROM public.floor_room_layout f
          WHERE f.room_number = pr.room_number
            AND f.dorm_id = COALESCE(pr.dorm_id, u.dorm_id)),
        CASE
          WHEN regexp_replace(pr.room_number, '\D', '', 'g') <> ''
          THEN GREATEST(1, ((regexp_replace(pr.room_number, '\D', '', 'g')::int - 1) / 30) + 1)
          ELSE NULL
        END
      ),
      updated_at = now()
  FROM public.permit_requests pr
  WHERE u.id = p_user_id
    AND pr.id = v_permit_id
    AND pr.room_number IS NOT NULL
    AND u.room_number IS NULL;

  UPDATE public.permit_requests
  SET status = 'registered',
      updated_at = now()
  WHERE id = v_permit_id
    AND status = 'approved';

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_pending_student(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_pending_student(uuid, text)
  TO service_role;
