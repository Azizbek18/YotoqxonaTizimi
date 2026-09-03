-- ==========================================================
-- Fix: xona bandligi ikki marta sanalardi
-- ==========================================================
-- Talaba tasdiqlangan yo'llanmadan ro'yxatdan o'tsa, `users` qatori
-- yaratiladi (room_number to'ldiriladi), lekin `permit_requests` qatori
-- ham 'approved' + room_number bilan qoladi (app/api/student/register).
-- assign_*_room_atomic ichidagi bandlik hisobi `users UNION ALL
-- permit_requests` bo'lgani uchun bunday talaba IKKI marta sanalgan —
-- natijada sig'imi 4 bo'lgan, 3 kishi yashaydigan xona 4-talabani rad
-- etardi ("Room is full").
--
-- Yechim: yo'llanma qatori bandlik hisobiga faqat SHU xonada allaqachon
-- ro'yxatdan o'tgan `users` qatori BO'LMASA qo'shiladi (passport_series
-- yoki JSHSHIR bo'yicha moslashtiriladi). Boshqa hech narsa o'zgarmaydi —
-- funksiya tanalari 202609240000 dan, faqat bandlik quyi-so'rovi.

-- ----------------------------------------------------------
-- assign_student_room_atomic
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_student_room_atomic(
  p_student_id uuid, p_room_number text, p_max_capacity int DEFAULT 4
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_faculty text; v_gender text; v_row_dorm uuid; v_dorm_id uuid;
  v_floor int; v_floor_owner text; v_df_found boolean;
  v_frozen boolean; v_room_capacity smallint; v_room_gender text; v_occupied int; v_conflicting int;
BEGIN
  SELECT COALESCE(NULLIF(faculty, ''), 'amit'), gender, dorm_id
  INTO v_faculty, v_gender, v_row_dorm
  FROM public.users WHERE id = p_student_id AND role = 'talaba';
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0001'; END IF;

  v_dorm_id := COALESCE(v_row_dorm, (SELECT dorm_id FROM public.faculty_dorm WHERE faculty = v_faculty));
  IF v_dorm_id IS NULL THEN RAISE EXCEPTION 'No dorm for faculty %', v_faculty USING ERRCODE = 'P0002'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_dorm_id::text || ':' || p_room_number));

  SELECT floor_number, frozen, capacity, gender INTO v_floor, v_frozen, v_room_capacity, v_room_gender
  FROM public.floor_room_layout
  WHERE dorm_id = v_dorm_id AND room_number = p_room_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002'; END IF;
  IF v_frozen THEN RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004'; END IF;

  IF v_room_gender IS NOT NULL AND v_gender IS NOT NULL AND v_room_gender <> v_gender THEN
    RAISE EXCEPTION 'Room reserved for other gender' USING ERRCODE = 'P0001';
  END IF;

  SELECT faculty INTO v_floor_owner FROM public.dorm_floor
  WHERE dorm_id = v_dorm_id AND floor_number = v_floor;
  v_df_found := FOUND;
  IF v_df_found AND v_floor_owner IS DISTINCT FROM v_faculty THEN
    RAISE EXCEPTION 'Room is on another faculty''s floor' USING ERRCODE = 'P0007';
  END IF;

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users
    WHERE role = 'talaba' AND room_number = p_room_number
      AND (dorm_id = v_dorm_id OR dorm_id IS NULL) AND id <> p_student_id
    UNION ALL
    SELECT pr.id FROM public.permit_requests pr
    WHERE pr.status = 'approved' AND pr.room_number = p_room_number
      AND (pr.dorm_id = v_dorm_id OR pr.dorm_id IS NULL)
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
        AND (dorm_id = v_dorm_id OR dorm_id IS NULL) AND id <> p_student_id AND gender IS NOT NULL
      UNION ALL
      SELECT gender FROM public.permit_requests
      WHERE status = 'approved' AND room_number = p_room_number
        AND (dorm_id = v_dorm_id OR dorm_id IS NULL) AND gender IS NOT NULL
    ) g WHERE g.gender <> v_gender;
    IF v_conflicting > 0 THEN RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001'; END IF;
  END IF;

  UPDATE public.users
  SET room_number = p_room_number, dorm_id = v_dorm_id, assigned_floor = v_floor
  WHERE id = p_student_id;
END;
$$;

-- ----------------------------------------------------------
-- approve_permit_room_atomic
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_permit_room_atomic(
  p_permit_id uuid, p_room_number text, p_max_capacity int DEFAULT 4
)
RETURNS SETOF public.permit_requests
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_faculty text; v_gender text; v_dorm_id uuid;
  v_floor int; v_floor_owner text; v_df_found boolean;
  v_frozen boolean; v_room_capacity smallint; v_room_gender text; v_occupied int; v_conflicting int;
BEGIN
  SELECT COALESCE(NULLIF(faculty, ''), 'amit') INTO v_faculty
  FROM public.permit_requests WHERE id = p_permit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permit not pending' USING ERRCODE = 'P0001'; END IF;

  v_dorm_id := (SELECT dorm_id FROM public.faculty_dorm WHERE faculty = v_faculty);
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
  WHERE id = p_permit_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permit not pending' USING ERRCODE = 'P0001'; END IF;

  IF v_room_gender IS NOT NULL AND v_gender IS NOT NULL AND v_room_gender <> v_gender THEN
    RAISE EXCEPTION 'Room reserved for other gender' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users
    WHERE role = 'talaba' AND room_number = p_room_number AND (dorm_id = v_dorm_id OR dorm_id IS NULL)
    UNION ALL
    SELECT pr.id FROM public.permit_requests pr
    WHERE pr.status = 'approved' AND pr.room_number = p_room_number
      AND (pr.dorm_id = v_dorm_id OR pr.dorm_id IS NULL)
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
        AND (dorm_id = v_dorm_id OR dorm_id IS NULL) AND gender IS NOT NULL
    ) g WHERE g.gender <> v_gender;
    IF v_conflicting > 0 THEN RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001'; END IF;
  END IF;

  RETURN QUERY
  UPDATE public.permit_requests
  SET status = 'approved', room_number = p_room_number, dorm_id = v_dorm_id, reject_reason = NULL
  WHERE id = p_permit_id AND status = 'pending'
  RETURNING *;
END;
$$;

-- ----------------------------------------------------------
-- assign_permit_room_atomic
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_permit_room_atomic(
  p_permit_id uuid, p_room_number text, p_max_capacity int DEFAULT 4
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
END;
$$;

-- Grantlar (imzolar o'zgarmadi)
REVOKE ALL ON FUNCTION public.assign_student_room_atomic(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_student_room_atomic(uuid, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_student_room_atomic(uuid, text, int) TO service_role;
REVOKE ALL ON FUNCTION public.approve_permit_room_atomic(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_permit_room_atomic(uuid, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_permit_room_atomic(uuid, text, int) TO service_role;
REVOKE ALL ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) TO service_role;
