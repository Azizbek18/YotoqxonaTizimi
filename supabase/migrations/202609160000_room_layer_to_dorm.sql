-- ==========================================================
-- P3 — Xona qatlami: faculty -> dorm_id
-- ==========================================================
-- Xona endi FAKULTETga emas, YOTOQXONAga tegishli. Xona raqami dorm
-- ichida yagona. Xonaning "egasi" fakulteti — o'sha xona qavatini qaysi
-- fakultet tasdiqlagani (dorm_floor). RPC'lar imzosi o'zgarmaydi —
-- ichkarida dorm_id fakultetdan (faculty_dorm) olinadi.
--
-- Bitta yotoqxonali holatда (hozirgi prod) xatti-harakat AYNAN bir xil:
-- faculty_dorm'da 1 qator, dorm_floor barcha qavatlarni amit ga
-- tasdiqlagan -> egalik tekshiruvi o'tadi, bandlik hisobi o'zgarmaydi.
--
-- Yangi errcode P0007 = "xona boshqa fakultet qavatida".

-- ----------------------------------------------------------
-- 1. floor_room_layout — xona raqami dorm bo'yicha yagona
-- ----------------------------------------------------------
UPDATE public.floor_room_layout l
SET dorm_id = fd.dorm_id
FROM public.faculty_dorm fd
WHERE l.dorm_id IS NULL
  AND fd.faculty = coalesce(nullif(btrim(l.faculty), ''), 'amit');

ALTER TABLE public.floor_room_layout ALTER COLUMN dorm_id SET NOT NULL;
ALTER TABLE public.floor_room_layout DROP CONSTRAINT IF EXISTS floor_room_layout_faculty_room_number_key;
ALTER TABLE public.floor_room_layout DROP CONSTRAINT IF EXISTS floor_room_layout_dorm_room_number_key;
ALTER TABLE public.floor_room_layout ADD CONSTRAINT floor_room_layout_dorm_room_number_key UNIQUE (dorm_id, room_number);

DROP INDEX IF EXISTS floor_room_layout_floor_idx;
CREATE INDEX IF NOT EXISTS floor_room_layout_dorm_floor_idx
  ON public.floor_room_layout (dorm_id, floor_number, side, position);

-- ----------------------------------------------------------
-- 2. replace_floor_room_layout(p_faculty, p_floor_number, p_rows)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.replace_floor_room_layout(
  p_faculty text,
  p_floor_number int,
  p_rows jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dorm_id uuid;
  v_floor_owner text;
  v_removed_rooms text[];
  v_room text;
  v_removed_occupied text;
  v_frozen_snapshot jsonb;
BEGIN
  SELECT dorm_id INTO v_dorm_id FROM public.faculty_dorm WHERE faculty = p_faculty;
  IF v_dorm_id IS NULL THEN
    RAISE EXCEPTION 'No dorm for faculty %', p_faculty USING ERRCODE = 'P0002';
  END IF;

  -- Bo'lingan binoda faqat o'z qavatingga tarx chizasan. Egasi yo'q
  -- (tasdiqlanmagan) qavat — o'tish davri uchun ruxsat.
  SELECT faculty INTO v_floor_owner FROM public.dorm_floor
  WHERE dorm_id = v_dorm_id AND floor_number = p_floor_number;
  IF v_floor_owner IS NOT NULL AND v_floor_owner <> p_faculty THEN
    RAISE EXCEPTION 'Floor % belongs to %', p_floor_number, v_floor_owner USING ERRCODE = 'P0007';
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
          AND (u.dorm_id = v_dorm_id OR u.dorm_id IS NULL)
      )
      OR EXISTS (
        SELECT 1 FROM public.permit_requests p
        WHERE p.status = 'approved' AND p.room_number = old.room_number
          AND (p.dorm_id = v_dorm_id OR p.dorm_id IS NULL)
      )
    );

  IF v_removed_occupied IS NOT NULL THEN
    RAISE EXCEPTION 'Occupied rooms cannot be removed from layout: %', v_removed_occupied USING ERRCODE = 'P0003';
  END IF;

  SELECT jsonb_object_agg(old.room_number, jsonb_build_object('frozen', old.frozen, 'reason', old.frozen_reason))
  INTO v_frozen_snapshot
  FROM public.floor_room_layout old
  WHERE old.dorm_id = v_dorm_id AND old.floor_number = p_floor_number AND old.frozen;

  DELETE FROM public.floor_room_layout
  WHERE dorm_id = v_dorm_id AND floor_number = p_floor_number;

  INSERT INTO public.floor_room_layout (dorm_id, faculty, floor_number, room_number, side, position, size, frozen, frozen_reason)
  SELECT
    v_dorm_id,
    p_faculty,
    p_floor_number,
    r->>'roomNumber',
    r->>'side',
    (r->>'position')::int,
    r->>'size',
    COALESCE((v_frozen_snapshot -> (r->>'roomNumber') ->> 'frozen')::boolean, false),
    v_frozen_snapshot -> (r->>'roomNumber') ->> 'reason'
  FROM jsonb_array_elements(p_rows) AS r;
END;
$$;

-- ----------------------------------------------------------
-- 3. Umumiy yordamchi: talaba/yo'llanma binosi + xona qavati egaligi
-- ----------------------------------------------------------
-- (inline yozamiz — har RPC ichida bir xil bloklar)

-- ----------------------------------------------------------
-- assign_student_room_atomic
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_student_room_atomic(
  p_student_id uuid,
  p_room_number text,
  p_max_capacity int DEFAULT 4
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_faculty text;
  v_gender text;
  v_row_dorm uuid;
  v_dorm_id uuid;
  v_floor int;
  v_floor_owner text;
  v_frozen boolean;
  v_occupied int;
  v_conflicting int;
BEGIN
  SELECT COALESCE(NULLIF(faculty, ''), 'amit'), gender, dorm_id
  INTO v_faculty, v_gender, v_row_dorm
  FROM public.users WHERE id = p_student_id AND role = 'talaba';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0001';
  END IF;

  v_dorm_id := COALESCE(v_row_dorm, (SELECT dorm_id FROM public.faculty_dorm WHERE faculty = v_faculty));
  IF v_dorm_id IS NULL THEN
    RAISE EXCEPTION 'No dorm for faculty %', v_faculty USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_dorm_id::text || ':' || p_room_number));

  SELECT floor_number, frozen INTO v_floor, v_frozen FROM public.floor_room_layout
  WHERE dorm_id = v_dorm_id AND room_number = p_room_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002';
  END IF;
  IF v_frozen THEN
    RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004';
  END IF;

  SELECT faculty INTO v_floor_owner FROM public.dorm_floor
  WHERE dorm_id = v_dorm_id AND floor_number = v_floor;
  IF v_floor_owner IS NOT NULL AND v_floor_owner <> v_faculty THEN
    RAISE EXCEPTION 'Room is on another faculty''s floor' USING ERRCODE = 'P0007';
  END IF;

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users
    WHERE role = 'talaba' AND room_number = p_room_number
      AND (dorm_id = v_dorm_id OR dorm_id IS NULL) AND id <> p_student_id
    UNION ALL
    SELECT id FROM public.permit_requests
    WHERE status = 'approved' AND room_number = p_room_number
      AND (dorm_id = v_dorm_id OR dorm_id IS NULL)
  ) occupants;

  IF v_occupied >= p_max_capacity THEN
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

    IF v_conflicting > 0 THEN
      RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.users
  SET room_number = p_room_number, dorm_id = v_dorm_id, assigned_floor = v_floor
  WHERE id = p_student_id;
END;
$$;

-- ----------------------------------------------------------
-- approve_permit_room_atomic (pending -> approved + room)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_permit_room_atomic(
  p_permit_id uuid,
  p_room_number text,
  p_max_capacity int DEFAULT 4
)
RETURNS SETOF public.permit_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_faculty text;
  v_gender text;
  v_dorm_id uuid;
  v_floor int;
  v_floor_owner text;
  v_frozen boolean;
  v_occupied int;
  v_conflicting int;
BEGIN
  SELECT COALESCE(NULLIF(faculty, ''), 'amit') INTO v_faculty
  FROM public.permit_requests WHERE id = p_permit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permit not pending' USING ERRCODE = 'P0001';
  END IF;

  v_dorm_id := (SELECT dorm_id FROM public.faculty_dorm WHERE faculty = v_faculty);
  IF v_dorm_id IS NULL THEN
    RAISE EXCEPTION 'No dorm for faculty %', v_faculty USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_dorm_id::text || ':' || p_room_number));

  SELECT floor_number, frozen INTO v_floor, v_frozen FROM public.floor_room_layout
  WHERE dorm_id = v_dorm_id AND room_number = p_room_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002';
  END IF;
  IF v_frozen THEN
    RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004';
  END IF;

  SELECT faculty INTO v_floor_owner FROM public.dorm_floor
  WHERE dorm_id = v_dorm_id AND floor_number = v_floor;
  IF v_floor_owner IS NOT NULL AND v_floor_owner <> v_faculty THEN
    RAISE EXCEPTION 'Room is on another faculty''s floor' USING ERRCODE = 'P0007';
  END IF;

  SELECT gender INTO v_gender FROM public.permit_requests
  WHERE id = p_permit_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permit not pending' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users
    WHERE role = 'talaba' AND room_number = p_room_number AND (dorm_id = v_dorm_id OR dorm_id IS NULL)
    UNION ALL
    SELECT id FROM public.permit_requests
    WHERE status = 'approved' AND room_number = p_room_number AND (dorm_id = v_dorm_id OR dorm_id IS NULL)
  ) occupants;

  IF v_occupied >= p_max_capacity THEN
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

    IF v_conflicting > 0 THEN
      RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN QUERY
  UPDATE public.permit_requests
  SET status = 'approved', room_number = p_room_number, dorm_id = v_dorm_id, reject_reason = NULL
  WHERE id = p_permit_id AND status = 'pending'
  RETURNING *;
END;
$$;

-- ----------------------------------------------------------
-- assign_permit_room_atomic (approved permit -> room, P0005 if not approved)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_permit_room_atomic(
  p_permit_id uuid,
  p_room_number text,
  p_max_capacity int DEFAULT 4
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_faculty text;
  v_gender text;
  v_row_dorm uuid;
  v_dorm_id uuid;
  v_floor int;
  v_floor_owner text;
  v_frozen boolean;
  v_occupied int;
  v_conflicting int;
BEGIN
  SELECT COALESCE(NULLIF(faculty, ''), 'amit'), dorm_id INTO v_faculty, v_row_dorm
  FROM public.permit_requests WHERE id = p_permit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permit not approved' USING ERRCODE = 'P0005';
  END IF;

  v_dorm_id := COALESCE(v_row_dorm, (SELECT dorm_id FROM public.faculty_dorm WHERE faculty = v_faculty));
  IF v_dorm_id IS NULL THEN
    RAISE EXCEPTION 'No dorm for faculty %', v_faculty USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_dorm_id::text || ':' || p_room_number));

  SELECT floor_number, frozen INTO v_floor, v_frozen FROM public.floor_room_layout
  WHERE dorm_id = v_dorm_id AND room_number = p_room_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002';
  END IF;
  IF v_frozen THEN
    RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004';
  END IF;

  SELECT faculty INTO v_floor_owner FROM public.dorm_floor
  WHERE dorm_id = v_dorm_id AND floor_number = v_floor;
  IF v_floor_owner IS NOT NULL AND v_floor_owner <> v_faculty THEN
    RAISE EXCEPTION 'Room is on another faculty''s floor' USING ERRCODE = 'P0007';
  END IF;

  SELECT gender INTO v_gender FROM public.permit_requests
  WHERE id = p_permit_id AND status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permit not approved' USING ERRCODE = 'P0005';
  END IF;

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users
    WHERE role = 'talaba' AND room_number = p_room_number AND (dorm_id = v_dorm_id OR dorm_id IS NULL)
    UNION ALL
    SELECT id FROM public.permit_requests
    WHERE status = 'approved' AND room_number = p_room_number
      AND (dorm_id = v_dorm_id OR dorm_id IS NULL) AND id <> p_permit_id
  ) occupants;

  IF v_occupied >= p_max_capacity THEN
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

    IF v_conflicting > 0 THEN
      RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.permit_requests
  SET room_number = p_room_number, dorm_id = v_dorm_id, updated_at = now()
  WHERE id = p_permit_id AND status = 'approved';
END;
$$;

-- ----------------------------------------------------------
-- 4. Grantlar (imzo o'zgarmadi — qayta beramiz)
-- ----------------------------------------------------------
REVOKE ALL ON FUNCTION public.replace_floor_room_layout(text, int, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.replace_floor_room_layout(text, int, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_floor_room_layout(text, int, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.assign_student_room_atomic(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_student_room_atomic(uuid, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_student_room_atomic(uuid, text, int) TO service_role;

REVOKE ALL ON FUNCTION public.approve_permit_room_atomic(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_permit_room_atomic(uuid, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_permit_room_atomic(uuid, text, int) TO service_role;

REVOKE ALL ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) TO service_role;
