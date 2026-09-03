-- ==========================================================
-- Xona jinsi (dekan oldindan belgilaydi)
-- ==========================================================
-- Ilgari xona jinsi faqat joylashtirilgan talabalardan KELIB CHIQARDI —
-- hech kim joylashmaguncha "bu qizlar xonasi / o'g'il xonasi" bilinmasdi.
-- Endi dekan Xonalar xaritasidan har xonaga jins BELGILAYDI
-- (floor_room_layout.gender). NULL = belgilanmagan (istalgan jins).
--
-- 5 ta funksiya CREATE OR REPLACE qilinadi (tanasi aynan
-- 202609180000_room_capacity_override.sql dan — apply_building_layout esa
-- 20260902083930_apply_building_layout_occ_faculty_scope.sql dan — faqat
-- jins joyi qo'shildi):
--   assign_student_room_atomic / approve_permit_room_atomic /
--   assign_permit_room_atomic:
--     SELECT ... , gender INTO ... , v_room_gender
--     IF v_room_gender IS NOT NULL AND v_gender IS NOT NULL
--        AND v_room_gender <> v_gender THEN RAISE 'Room reserved for other gender'
--   replace_floor_room_layout:
--     v_gender_snapshot — 3D quruvchi jinsni yubormaydi, shuning uchun
--     saqlangan qiymat qavat qayta saqlanganda ham qoladi.
--   apply_building_layout:
--     jins pinned/renum xonalarda ko'chadi, fresh xonada NULL.
-- Funksiya IMZOLARI o'zgarmaydi.

ALTER TABLE public.floor_room_layout
  ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE public.floor_room_layout
  DROP CONSTRAINT IF EXISTS floor_room_layout_gender_check;
ALTER TABLE public.floor_room_layout
  ADD CONSTRAINT floor_room_layout_gender_check
  CHECK (gender IS NULL OR gender IN ('male', 'female'));

-- ----------------------------------------------------------
-- replace_floor_room_layout
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

  -- Eski sig'im qiymatlari: editor `capacity` kalitini yubormasa (eski
  -- klient), o'sha xonaning oldingi override'i saqlanib qoladi. Kalit BOR
  -- bo'lsa (null bo'lsa ham) — kelgan qiymat ustun.
  SELECT jsonb_object_agg(old.room_number, old.capacity)
  INTO v_capacity_snapshot
  FROM public.floor_room_layout old
  WHERE old.dorm_id = v_dorm_id AND old.floor_number = p_floor_number AND old.capacity IS NOT NULL;

  -- Jins: 3D quruvchi bu maydonni umuman yubormaydi, shuning uchun har doim
  -- saqlangan qiymatdan tiklaymiz (xona raqami saqlansa jinsi ham qoladi).
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
$$;

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
    SELECT id FROM public.permit_requests
    WHERE status = 'approved' AND room_number = p_room_number
      AND (dorm_id = v_dorm_id OR dorm_id IS NULL)
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
    SELECT id FROM public.permit_requests
    WHERE status = 'approved' AND room_number = p_room_number AND (dorm_id = v_dorm_id OR dorm_id IS NULL)
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
END;
$$;

-- ----------------------------------------------------------
-- apply_building_layout (jins pinned/renum xonalarda ko'chadi)
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_building_layout(
  p_faculty text,
  p_numbering text,
  p_floors jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dorm_id uuid;
  v_bad_floor int;
  v_conflicts text;
  v_created int := 0;
  v_removed int := 0;
  v_renumbered int := 0;
  v_room text;
BEGIN
  IF p_numbering NOT IN ('sequential', 'per-floor') THEN
    RAISE EXCEPTION 'Bad numbering %', p_numbering USING ERRCODE = '22023';
  END IF;

  SELECT dorm_id INTO v_dorm_id FROM public.faculty_dorm WHERE faculty = p_faculty;
  IF v_dorm_id IS NULL THEN
    RAISE EXCEPTION 'No dorm for faculty %', p_faculty USING ERRCODE = 'P0002';
  END IF;

  SELECT df.floor_number INTO v_bad_floor
  FROM public.dorm_floor df
  WHERE df.dorm_id = v_dorm_id
    AND df.faculty IS DISTINCT FROM p_faculty
    AND df.floor_number IN (SELECT (e->>'floor')::int FROM jsonb_array_elements(p_floors) e)
  LIMIT 1;
  IF v_bad_floor IS NOT NULL THEN
    RAISE EXCEPTION 'Floor % is not confirmed to %', v_bad_floor, p_faculty USING ERRCODE = 'P0007';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_dorm_id::text || ':layout'));
  FOR v_room IN
    SELECT room_number FROM public.floor_room_layout
    WHERE dorm_id = v_dorm_id
      AND floor_number IN (SELECT (e->>'floor')::int FROM jsonb_array_elements(p_floors) e)
    ORDER BY room_number
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext(v_dorm_id::text || ':' || v_room));
  END LOOP;

  CREATE TEMP TABLE _occ ON COMMIT DROP AS
    SELECT u.room_number FROM public.users u
      WHERE u.role = 'talaba' AND u.room_number IS NOT NULL
        AND (u.dorm_id = v_dorm_id OR (u.dorm_id IS NULL
             AND (SELECT fd.dorm_id FROM public.faculty_dorm fd WHERE fd.faculty = u.faculty) = v_dorm_id))
    UNION
    SELECT p.room_number FROM public.permit_requests p
      WHERE p.status = 'approved' AND p.room_number IS NOT NULL
        AND (p.dorm_id = v_dorm_id OR (p.dorm_id IS NULL
             AND (SELECT fd.dorm_id FROM public.faculty_dorm fd WHERE fd.faculty = p.faculty) = v_dorm_id));

  CREATE TEMP TABLE _range ON COMMIT DROP AS
  SELECT floor, rooms, lo, lo + rooms - 1 AS hi
  FROM (
    WITH plan AS (
      SELECT (e->>'floor')::int AS floor,
             GREATEST((e->>'rooms')::int, 0) AS rooms
      FROM jsonb_array_elements(p_floors) e
    )
    SELECT floor, rooms,
           CASE WHEN p_numbering = 'per-floor'
             THEN floor * 100 + 1
             ELSE COALESCE(sum(rooms) OVER (ORDER BY floor
                   ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) + 1
           END AS lo
    FROM plan
  ) x;

  CREATE TEMP TABLE _cur ON COMMIT DROP AS
  SELECT l.room_number, l.floor_number, l.side, l.size, l.frozen, l.frozen_reason, l.capacity, l.gender,
         (l.room_number ~ '^[0-9]+$') AS is_num,
         CASE WHEN l.room_number ~ '^[0-9]+$' THEN l.room_number::int END AS rn,
         EXISTS (SELECT 1 FROM _occ o WHERE o.room_number = l.room_number) AS occupied
  FROM public.floor_room_layout l
  WHERE l.dorm_id = v_dorm_id
    AND l.floor_number IN (SELECT floor FROM _range);

  SELECT string_agg(c.room_number, ', ' ORDER BY c.room_number) INTO v_conflicts
  FROM _cur c
  JOIN _range r ON r.floor = c.floor_number
  WHERE c.occupied
    AND (
      NOT c.is_num OR c.rn < r.lo OR c.rn > r.hi
      OR (SELECT count(*) FROM _cur c2
          WHERE c2.floor_number = c.floor_number AND c2.occupied) > r.rooms
    );
  IF v_conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'Band xonalarni qayta raqamlab bo''lmadi: %', v_conflicts USING ERRCODE = 'P0003';
  END IF;

  CREATE TEMP TABLE _new ON COMMIT DROP AS
  WITH pinned AS (
    SELECT c.floor_number AS floor, c.rn AS num, c.room_number AS old_number,
           c.side, c.size, c.frozen, c.frozen_reason, c.capacity, c.gender
    FROM _cur c WHERE c.occupied
  ),
  avail AS (
    SELECT r.floor, g AS num,
           row_number() OVER (PARTITION BY r.floor ORDER BY g) AS idx
    FROM _range r
    CROSS JOIN LATERAL generate_series(r.lo, r.hi) AS g
    WHERE NOT EXISTS (SELECT 1 FROM pinned p WHERE p.floor = r.floor AND p.num = g)
  ),
  movable AS (
    SELECT c.*, row_number() OVER (PARTITION BY c.floor_number
             ORDER BY c.rn NULLS LAST, c.room_number) AS idx
    FROM _cur c WHERE NOT c.occupied
  ),
  renum AS (
    SELECT m.floor_number AS floor, a.num, m.room_number AS old_number,
           m.side, m.size, m.frozen, m.frozen_reason, m.capacity, m.gender
    FROM movable m
    JOIN avail a ON a.floor = m.floor_number AND a.idx = m.idx
  ),
  fresh AS (
    SELECT a.floor, a.num, NULL::text AS old_number,
           CASE WHEN a.idx % 2 = 1 THEN 'left' ELSE 'right' END AS side,
           'medium'::text AS size, false AS frozen, NULL::text AS frozen_reason,
           NULL::smallint AS capacity, NULL::text AS gender
    FROM avail a
    WHERE a.idx > (SELECT COALESCE(max(m.idx), 0) FROM movable m WHERE m.floor_number = a.floor)
  )
  SELECT floor, num::text AS room_number, old_number, side, size, frozen, frozen_reason, capacity, gender,
         'pin'::text AS kind FROM pinned
  UNION ALL
  SELECT floor, num::text, old_number, side, size, frozen, frozen_reason, capacity, gender, 'renum' FROM renum
  UNION ALL
  SELECT floor, num::text, old_number, side, size, frozen, frozen_reason, capacity, gender, 'new' FROM fresh;

  SELECT count(*) FILTER (WHERE kind = 'new'),
         count(*) FILTER (WHERE kind = 'renum' AND room_number IS DISTINCT FROM old_number)
    INTO v_created, v_renumbered
  FROM _new;
  SELECT count(*) INTO v_removed
  FROM _cur c WHERE NOT c.occupied
    AND NOT EXISTS (SELECT 1 FROM _new n WHERE n.old_number = c.room_number);

  DELETE FROM public.floor_room_layout
  WHERE dorm_id = v_dorm_id AND floor_number IN (SELECT floor FROM _range);

  INSERT INTO public.floor_room_layout
    (dorm_id, faculty, floor_number, room_number, side, position, size, frozen, frozen_reason, capacity, gender)
  SELECT v_dorm_id, p_faculty, n.floor, n.room_number, n.side,
         (row_number() OVER (PARTITION BY n.floor, n.side ORDER BY (n.room_number)::int))::int - 1,
         n.size, n.frozen, n.frozen_reason, n.capacity, n.gender
  FROM _new n;

  UPDATE public.cleaning_schedule cs SET room_number = n.room_number
  FROM _new n
  WHERE n.kind = 'renum' AND n.old_number IS DISTINCT FROM n.room_number
    AND cs.faculty = p_faculty AND cs.room_number = n.old_number;

  UPDATE public.users u SET assigned_floor = fl.floor_number
  FROM public.floor_room_layout fl
  WHERE fl.dorm_id = v_dorm_id AND fl.room_number = u.room_number
    AND u.role = 'talaba' AND u.room_number IN (SELECT room_number FROM _occ)
    AND (u.dorm_id = v_dorm_id OR (u.dorm_id IS NULL
         AND (SELECT fd.dorm_id FROM public.faculty_dorm fd WHERE fd.faculty = u.faculty) = v_dorm_id))
    AND u.assigned_floor IS DISTINCT FROM fl.floor_number;

  RETURN jsonb_build_object(
    'created', v_created,
    'removed', v_removed,
    'renumbered', v_renumbered
  );
END;
$$;

-- Grantlar (imzolar o'zgarmadi — 202609180000 dagidek qayta beriladi)
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
REVOKE ALL ON FUNCTION public.apply_building_layout(text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_building_layout(text, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_building_layout(text, text, jsonb) TO service_role;
