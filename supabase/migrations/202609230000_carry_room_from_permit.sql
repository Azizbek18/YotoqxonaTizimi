-- ==========================================================
-- Talabaga biriktirilgan xona "yo'qolib qolishi" muammosini tuzatish
-- ==========================================================
-- MUAMMO: dekan xonani permit_requests qatoriga biriktiradi (talaba hali
-- emailini tasdiqlamagan, ya'ni users.status = 'pending' — shu sabab dekan
-- panelida "Ro'yxatdan o'tmagan" sifatida ko'rinadi). assign_permit_room_atomic
-- faqat permit_requests.room_number ni yozadi. Keyin talaba emailini
-- tasdiqlaganda activate_pending_student faqat status'ni 'active' qiladi va
-- permitni 'registered' qiladi — LEKIN permit.room_number ni users.room_number
-- ga ko'chirmaydi. Natijada talaba faollashadi, xonasi NULL bo'lib qoladi va
-- dashboardda xona ko'rinmaydi.
--
-- Xonani permit -> users ga ko'chiruvchi yagona joy hozircha
-- app/api/student/register/route.ts dagi INSERT edi — ya'ni faqat talaba
-- xonadan OLDIN ro'yxatdan o'tsa ishlaydi.
--
-- TUZATISH (2 funksiya):
--   1. assign_permit_room_atomic — permitga xona yozgandan so'ng, o'sha permitga
--      mos 'pending' users qatorini ham darhol yangilaydi (tasdiqlashni kutmasdan).
--   2. activate_pending_student — faollashtirish paytida, agar users.room_number
--      NULL bo'lsa va permitda xona bo'lsa, xonani + assigned_floor + dorm_id ni
--      ko'chiradi. Bu har bir talaba o'tadigan yagona nuqta — asosiy himoya shu.
--
-- assign_permit_room_atomic tanasi 202609180000 (dorm + per-room capacity)
-- versiyasidan AYNAN olingan; oxiriga faqat 'pending' akkauntga ko'chirish
-- qo'shilgan. activate_pending_student tanasi 20260830173311 dan.

-- ---------------------------------------------------------------------
-- assign_permit_room_atomic — permitga xona + mos 'pending' akkauntga xona
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_permit_room_atomic(
  p_permit_id uuid, p_room_number text, p_max_capacity int DEFAULT 4
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_faculty text; v_gender text; v_row_dorm uuid; v_dorm_id uuid;
  v_floor int; v_floor_owner text; v_df_found boolean;
  v_frozen boolean; v_room_capacity smallint; v_occupied int; v_conflicting int;
BEGIN
  SELECT COALESCE(NULLIF(faculty, ''), 'amit'), dorm_id INTO v_faculty, v_row_dorm
  FROM public.permit_requests WHERE id = p_permit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permit not approved' USING ERRCODE = 'P0005'; END IF;

  v_dorm_id := COALESCE(v_row_dorm, (SELECT dorm_id FROM public.faculty_dorm WHERE faculty = v_faculty));
  IF v_dorm_id IS NULL THEN RAISE EXCEPTION 'No dorm for faculty %', v_faculty USING ERRCODE = 'P0002'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_dorm_id::text || ':' || p_room_number));

  SELECT floor_number, frozen, capacity INTO v_floor, v_frozen, v_room_capacity
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

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users
    WHERE role = 'talaba' AND room_number = p_room_number AND (dorm_id = v_dorm_id OR dorm_id IS NULL)
    UNION ALL
    SELECT id FROM public.permit_requests
    WHERE status = 'approved' AND room_number = p_room_number
      AND (dorm_id = v_dorm_id OR dorm_id IS NULL) AND id <> p_permit_id
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

  -- Xonani darhol mos 'pending' akkauntga ham ko'chiramiz. Bo'lmasa talaba
  -- emailini tasdiqlaguncha (activate_pending_student) xona ko'rinmay turadi
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
$$;

REVOKE ALL ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) TO service_role;

-- ---------------------------------------------------------------------
-- activate_pending_student — faollashtirishda permit xonasini ko'chirish
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_pending_student(
  p_user_id uuid,
  p_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Dekan xonani permit qatoriga biriktirgan bo'lsa (talaba 'pending' ekan),
  -- uni endi akkauntga ko'chiramiz. Faqat akkauntda xona bo'lmasa —
  -- assign_permit_room_atomic allaqachon ko'chirgan bo'lishi mumkin.
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
$$;

REVOKE ALL ON FUNCTION public.activate_pending_student(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_pending_student(uuid, text)
  TO service_role;
