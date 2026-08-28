-- ==========================================================
-- Bosqich 1d (2/2) — xona biriktirish RPC'lari fakultet bo'yicha
-- ==========================================================
-- Xona raqami endi FAQAT bir fakultet binosi ichida yagona (202609020000).
-- Uch atomik funksiya endi talaba/yo'llanmaning fakultetini oladi va
-- xona mavjudligi, muzlatilgan holati, sig'im, jins tekshiruvini —
-- shuningdek advisory lock kalitini — SHU fakultet bo'yicha cheklaydi.
--
-- Fakultet lock kaliti: hashtext(faculty || ':' || room_number). Bu kalit
-- replace_floor_room_layout dagi bilan AYNAN bir xil bo'lishi shart —
-- shuning uchun quyida u ham qayta chiqariladi (202607280008 tuzatgan
-- poyga qaytmasligi uchun).
--
-- Talabaning fakulteti = binosi (housing = akademik fakultet, doim).
-- Fakultetsiz (NULL/'') talabalar 'amit' binosiga tegishli deb olinadi —
-- tizimning qolgan qismidagi PRIMARY_FACULTY zaxira mantig'i bilan bir xil.
-- Fakultetlararo mavjud biriktirishlar 202609030000 da tozalangan.

-- ---------------------------------------------------------------------
-- assign_student_room_atomic
-- ---------------------------------------------------------------------
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
  v_occupied int;
  v_conflicting int;
  v_frozen boolean;
BEGIN
  -- Faculty is read before the lock: it names the building and does not
  -- change under room contention.
  SELECT COALESCE(NULLIF(faculty, ''), 'amit'), gender
  INTO v_faculty, v_gender
  FROM public.users WHERE id = p_student_id AND role = 'talaba';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_faculty || ':' || p_room_number));

  SELECT frozen INTO v_frozen FROM public.floor_room_layout
  WHERE faculty = v_faculty AND room_number = p_room_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002';
  END IF;
  IF v_frozen THEN
    RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004';
  END IF;

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users
    WHERE role = 'talaba' AND COALESCE(NULLIF(faculty, ''), 'amit') = v_faculty
      AND room_number = p_room_number AND id <> p_student_id
    UNION ALL
    SELECT id FROM public.permit_requests
    WHERE status = 'approved' AND COALESCE(NULLIF(faculty, ''), 'amit') = v_faculty
      AND room_number = p_room_number
  ) occupants;

  IF v_occupied >= p_max_capacity THEN
    RAISE EXCEPTION 'Room is full' USING ERRCODE = 'P0001';
  END IF;

  IF v_gender IS NOT NULL THEN
    SELECT count(*) INTO v_conflicting FROM (
      SELECT gender FROM public.users
      WHERE role = 'talaba' AND COALESCE(NULLIF(faculty, ''), 'amit') = v_faculty
        AND room_number = p_room_number AND id <> p_student_id AND gender IS NOT NULL
      UNION ALL
      SELECT gender FROM public.permit_requests
      WHERE status = 'approved' AND COALESCE(NULLIF(faculty, ''), 'amit') = v_faculty
        AND room_number = p_room_number AND gender IS NOT NULL
    ) g WHERE g.gender <> v_gender;

    IF v_conflicting > 0 THEN
      RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.users
  SET room_number = p_room_number,
      assigned_floor = COALESCE(
        (SELECT floor_number FROM public.floor_room_layout
         WHERE faculty = v_faculty AND room_number = p_room_number),
        CASE
          WHEN regexp_replace(p_room_number, '\D', '', 'g') <> ''
          THEN GREATEST(1, ((regexp_replace(p_room_number, '\D', '', 'g')::int - 1) / 30) + 1)
          ELSE NULL
        END
      )
  WHERE id = p_student_id;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_student_room_atomic(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_student_room_atomic(uuid, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_student_room_atomic(uuid, text, int) TO service_role;

-- ---------------------------------------------------------------------
-- approve_permit_room_atomic
-- ---------------------------------------------------------------------
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
  v_occupied int;
  v_conflicting int;
  v_frozen boolean;
BEGIN
  SELECT COALESCE(NULLIF(faculty, ''), 'amit') INTO v_faculty
  FROM public.permit_requests WHERE id = p_permit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permit not pending' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_faculty || ':' || p_room_number));

  SELECT frozen INTO v_frozen FROM public.floor_room_layout
  WHERE faculty = v_faculty AND room_number = p_room_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002';
  END IF;
  IF v_frozen THEN
    RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004';
  END IF;

  SELECT gender INTO v_gender FROM public.permit_requests
  WHERE id = p_permit_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permit not pending' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users
    WHERE role = 'talaba' AND COALESCE(NULLIF(faculty, ''), 'amit') = v_faculty AND room_number = p_room_number
    UNION ALL
    SELECT id FROM public.permit_requests
    WHERE status = 'approved' AND COALESCE(NULLIF(faculty, ''), 'amit') = v_faculty AND room_number = p_room_number
  ) occupants;

  IF v_occupied >= p_max_capacity THEN
    RAISE EXCEPTION 'Room is full' USING ERRCODE = 'P0001';
  END IF;

  IF v_gender IS NOT NULL THEN
    SELECT count(*) INTO v_conflicting FROM (
      SELECT gender FROM public.users
      WHERE role = 'talaba' AND COALESCE(NULLIF(faculty, ''), 'amit') = v_faculty
        AND room_number = p_room_number AND gender IS NOT NULL
      UNION ALL
      SELECT gender FROM public.permit_requests
      WHERE status = 'approved' AND COALESCE(NULLIF(faculty, ''), 'amit') = v_faculty
        AND room_number = p_room_number AND gender IS NOT NULL
    ) g WHERE g.gender <> v_gender;

    IF v_conflicting > 0 THEN
      RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN QUERY
  UPDATE public.permit_requests
  SET status = 'approved', room_number = p_room_number, reject_reason = NULL
  WHERE id = p_permit_id AND status = 'pending'
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_permit_room_atomic(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_permit_room_atomic(uuid, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_permit_room_atomic(uuid, text, int) TO service_role;

-- ---------------------------------------------------------------------
-- assign_permit_room_atomic (P0005 = permit no longer 'approved')
-- ---------------------------------------------------------------------
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
  v_occupied int;
  v_conflicting int;
  v_frozen boolean;
BEGIN
  SELECT COALESCE(NULLIF(faculty, ''), 'amit') INTO v_faculty
  FROM public.permit_requests WHERE id = p_permit_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permit not approved' USING ERRCODE = 'P0005';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_faculty || ':' || p_room_number));

  SELECT frozen INTO v_frozen FROM public.floor_room_layout
  WHERE faculty = v_faculty AND room_number = p_room_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002';
  END IF;
  IF v_frozen THEN
    RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004';
  END IF;

  SELECT gender INTO v_gender FROM public.permit_requests
  WHERE id = p_permit_id AND status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permit not approved' USING ERRCODE = 'P0005';
  END IF;

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users
    WHERE role = 'talaba' AND COALESCE(NULLIF(faculty, ''), 'amit') = v_faculty AND room_number = p_room_number
    UNION ALL
    SELECT id FROM public.permit_requests
    WHERE status = 'approved' AND COALESCE(NULLIF(faculty, ''), 'amit') = v_faculty
      AND room_number = p_room_number AND id <> p_permit_id
  ) occupants;

  IF v_occupied >= p_max_capacity THEN
    RAISE EXCEPTION 'Room is full' USING ERRCODE = 'P0001';
  END IF;

  IF v_gender IS NOT NULL THEN
    SELECT count(*) INTO v_conflicting FROM (
      SELECT gender FROM public.users
      WHERE role = 'talaba' AND COALESCE(NULLIF(faculty, ''), 'amit') = v_faculty
        AND room_number = p_room_number AND gender IS NOT NULL
      UNION ALL
      SELECT gender FROM public.permit_requests
      WHERE status = 'approved' AND COALESCE(NULLIF(faculty, ''), 'amit') = v_faculty
        AND room_number = p_room_number AND id <> p_permit_id AND gender IS NOT NULL
    ) g WHERE g.gender <> v_gender;

    IF v_conflicting > 0 THEN
      RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.permit_requests
  SET room_number = p_room_number, updated_at = now()
  WHERE id = p_permit_id AND status = 'approved';
END;
$$;

REVOKE ALL ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) TO service_role;

-- ---------------------------------------------------------------------
-- replace_floor_room_layout — lock keys re-scoped to match the RPCs above.
-- Body otherwise identical to 202609020002.
-- ---------------------------------------------------------------------
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
  v_removed_rooms text[];
  v_room text;
  v_removed_occupied text;
  v_frozen_snapshot jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_faculty || ':floor:' || p_floor_number::text));

  SELECT array_agg(DISTINCT old.room_number ORDER BY old.room_number) INTO v_removed_rooms
  FROM public.floor_room_layout old
  WHERE old.faculty = p_faculty
    AND old.floor_number = p_floor_number
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_rows) AS r
      WHERE r->>'roomNumber' = old.room_number
    );

  IF v_removed_rooms IS NOT NULL THEN
    FOREACH v_room IN ARRAY v_removed_rooms LOOP
      PERFORM pg_advisory_xact_lock(hashtext(p_faculty || ':' || v_room));
    END LOOP;
  END IF;

  SELECT string_agg(DISTINCT old.room_number, ', ') INTO v_removed_occupied
  FROM public.floor_room_layout old
  WHERE old.faculty = p_faculty
    AND old.floor_number = p_floor_number
    AND old.room_number = ANY(v_removed_rooms)
    AND (
      EXISTS (SELECT 1 FROM public.users u WHERE u.role = 'talaba' AND u.room_number = old.room_number)
      OR EXISTS (SELECT 1 FROM public.permit_requests p WHERE p.status = 'approved' AND p.room_number = old.room_number)
    );

  IF v_removed_occupied IS NOT NULL THEN
    RAISE EXCEPTION 'Occupied rooms cannot be removed from layout: %', v_removed_occupied USING ERRCODE = 'P0003';
  END IF;

  SELECT jsonb_object_agg(old.room_number, jsonb_build_object('frozen', old.frozen, 'reason', old.frozen_reason))
  INTO v_frozen_snapshot
  FROM public.floor_room_layout old
  WHERE old.faculty = p_faculty AND old.floor_number = p_floor_number AND old.frozen;

  DELETE FROM public.floor_room_layout
  WHERE faculty = p_faculty AND floor_number = p_floor_number;

  INSERT INTO public.floor_room_layout (faculty, floor_number, room_number, side, position, size, frozen, frozen_reason)
  SELECT
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

REVOKE ALL ON FUNCTION public.replace_floor_room_layout(text, int, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.replace_floor_room_layout(text, int, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_floor_room_layout(text, int, jsonb) TO service_role;
