-- ==========================================================
-- Xona RPClari: occupancy/gender hisobini faqat AYNAN shu yotoqxonaga cheklash
-- ==========================================================
-- Ilgari occupancy subquerylari `(dorm_id = v_dorm_id OR dorm_id IS NULL)` edi —
-- NULL-dorm talaba "23-xonada" har yotoqxonada band hisoblanardi va jinsi har
-- yotoqxonaning 23-xonasini qulflab qo'yardi. 20260904000836 backfill'idan keyin
-- xonasi bor NULL-dorm talaba qolmaydi, shuning uchun `OR ... IS NULL` ni
-- olib tashlaymiz — hisob endi faqat berilgan yotoqxona ichida.
--
-- Har funksiya tanasi prod'dagi joriy holatдан (assign_student: 202609250000,
-- assign_permit: 202609280001, approve_permit: 202609240000, replace_floor:
-- 202609170000) olindi; yagona o'zgarish — occupancy predikati.

-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_student_room_atomic(
  p_student_id uuid, p_room_number text, p_max_capacity integer DEFAULT 4
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
      AND dorm_id = v_dorm_id AND id <> p_student_id
    UNION ALL
    SELECT pr.id FROM public.permit_requests pr
    WHERE pr.status = 'approved' AND pr.room_number = p_room_number
      AND pr.dorm_id = v_dorm_id
      AND NOT EXISTS (
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
        AND dorm_id = v_dorm_id AND id <> p_student_id AND gender IS NOT NULL
      UNION ALL
      SELECT gender FROM public.permit_requests
      WHERE status = 'approved' AND room_number = p_room_number
        AND dorm_id = v_dorm_id AND gender IS NOT NULL
    ) g WHERE g.gender <> v_gender;
    IF v_conflicting > 0 THEN RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001'; END IF;
  END IF;

  UPDATE public.users
  SET room_number = p_room_number, dorm_id = v_dorm_id, assigned_floor = v_floor
  WHERE id = p_student_id;
END;
$function$;

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
    WHERE role = 'talaba' AND room_number = p_room_number AND dorm_id = v_dorm_id
    UNION ALL
    SELECT pr.id FROM public.permit_requests pr
    WHERE pr.status = 'approved' AND pr.room_number = p_room_number
      AND pr.dorm_id = v_dorm_id AND pr.id <> p_permit_id
      AND NOT EXISTS (
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
        AND dorm_id = v_dorm_id AND gender IS NOT NULL
      UNION ALL
      SELECT gender FROM public.permit_requests
      WHERE status = 'approved' AND room_number = p_room_number
        AND dorm_id = v_dorm_id AND id <> p_permit_id AND gender IS NOT NULL
    ) g WHERE g.gender <> v_gender;
    IF v_conflicting > 0 THEN RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001'; END IF;
  END IF;

  UPDATE public.permit_requests
  SET room_number = p_room_number, dorm_id = v_dorm_id, updated_at = now()
  WHERE id = p_permit_id AND status = 'approved';

  -- Xonani darhol mos 'pending' akkauntga ham ko'chiramiz (202609280001).
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
CREATE OR REPLACE FUNCTION public.approve_permit_room_atomic(
  p_permit_id uuid, p_room_number text, p_max_capacity integer DEFAULT 4
)
RETURNS SETOF permit_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    WHERE role = 'talaba' AND room_number = p_room_number AND dorm_id = v_dorm_id
    UNION ALL
    SELECT pr.id FROM public.permit_requests pr
    WHERE pr.status = 'approved' AND pr.room_number = p_room_number
      AND pr.dorm_id = v_dorm_id
      AND NOT EXISTS (
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
        AND dorm_id = v_dorm_id AND gender IS NOT NULL
      UNION ALL
      SELECT gender FROM public.permit_requests
      WHERE status = 'approved' AND room_number = p_room_number
        AND dorm_id = v_dorm_id AND gender IS NOT NULL
    ) g WHERE g.gender <> v_gender;
    IF v_conflicting > 0 THEN RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001'; END IF;
  END IF;

  RETURN QUERY
  UPDATE public.permit_requests
  SET status = 'approved', room_number = p_room_number, dorm_id = v_dorm_id, reject_reason = NULL
  WHERE id = p_permit_id AND status = 'pending'
  RETURNING *;
END;
$function$;

-- ---------------------------------------------------------------------
-- replace_floor_room_layout — band xona tekshiruvidan `OR dorm_id IS NULL` olib tashlash
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.replace_floor_room_layout(p_faculty text, p_floor_number integer, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dorm_id uuid;
  v_floor_owner text;
  v_removed_rooms text[];
  v_room text;
  v_removed_occupied text;
  v_frozen_snapshot jsonb;
  v_capacity_snapshot jsonb;
  v_gender_snapshot jsonb;
BEGIN
  SELECT dorm_id INTO v_dorm_id FROM public.faculty_dorm WHERE faculty = p_faculty;
  IF v_dorm_id IS NULL THEN
    RAISE EXCEPTION 'No dorm for faculty %', p_faculty USING ERRCODE = 'P0002';
  END IF;

  SELECT faculty INTO v_floor_owner FROM public.dorm_floor
  WHERE dorm_id = v_dorm_id AND floor_number = p_floor_number;
  IF FOUND AND v_floor_owner IS DISTINCT FROM p_faculty THEN
    RAISE EXCEPTION 'Floor % is not confirmed to %', p_floor_number, p_faculty USING ERRCODE = 'P0007';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_dorm_id::text || ':floor:' || p_floor_number::text));

  SELECT array_agg(DISTINCT old.room_number ORDER BY old.room_number) INTO v_removed_rooms
  FROM public.floor_room_layout old
  WHERE old.dorm_id = v_dorm_id
    AND old.floor_number = p_floor_number
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_rows) AS r
      WHERE r->>'roomNumber' = old.room_number
    );

  IF v_removed_rooms IS NOT NULL THEN
    FOREACH v_room IN ARRAY v_removed_rooms LOOP
      PERFORM pg_advisory_xact_lock(hashtext(v_dorm_id::text || ':' || v_room));
    END LOOP;
  END IF;

  SELECT string_agg(DISTINCT old.room_number, ', ') INTO v_removed_occupied
  FROM public.floor_room_layout old
  WHERE old.dorm_id = v_dorm_id
    AND old.floor_number = p_floor_number
    AND old.room_number = ANY(v_removed_rooms)
    AND (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.role = 'talaba' AND u.room_number = old.room_number
          AND u.dorm_id = v_dorm_id
      )
      OR EXISTS (
        SELECT 1 FROM public.permit_requests p
        WHERE p.status = 'approved' AND p.room_number = old.room_number
          AND p.dorm_id = v_dorm_id
      )
    );

  IF v_removed_occupied IS NOT NULL THEN
    RAISE EXCEPTION 'Occupied rooms cannot be removed from layout: %', v_removed_occupied USING ERRCODE = 'P0003';
  END IF;

  SELECT jsonb_object_agg(old.room_number, jsonb_build_object('frozen', old.frozen, 'reason', old.frozen_reason))
  INTO v_frozen_snapshot
  FROM public.floor_room_layout old
  WHERE old.dorm_id = v_dorm_id AND old.floor_number = p_floor_number AND old.frozen;

  SELECT jsonb_object_agg(old.room_number, old.capacity)
  INTO v_capacity_snapshot
  FROM public.floor_room_layout old
  WHERE old.dorm_id = v_dorm_id AND old.floor_number = p_floor_number AND old.capacity IS NOT NULL;

  SELECT jsonb_object_agg(old.room_number, old.gender)
  INTO v_gender_snapshot
  FROM public.floor_room_layout old
  WHERE old.dorm_id = v_dorm_id AND old.floor_number = p_floor_number AND old.gender IS NOT NULL;

  DELETE FROM public.floor_room_layout
  WHERE dorm_id = v_dorm_id AND floor_number = p_floor_number;

  INSERT INTO public.floor_room_layout
    (dorm_id, faculty, floor_number, room_number, side, position, size, frozen, frozen_reason, capacity, gender)
  SELECT
    v_dorm_id, p_faculty, p_floor_number,
    r->>'roomNumber', r->>'side', (r->>'position')::int, r->>'size',
    COALESCE((v_frozen_snapshot -> (r->>'roomNumber') ->> 'frozen')::boolean, false),
    v_frozen_snapshot -> (r->>'roomNumber') ->> 'reason',
    CASE
      WHEN r ? 'capacity' THEN NULLIF(r->>'capacity', '')::smallint
      ELSE (v_capacity_snapshot ->> (r->>'roomNumber'))::smallint
    END,
    (v_gender_snapshot ->> (r->>'roomNumber'))
  FROM jsonb_array_elements(p_rows) AS r;
END;
$function$;
