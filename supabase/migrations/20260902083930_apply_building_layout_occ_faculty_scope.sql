-- ==========================================================
-- Reconciliation: apply_building_layout — faculty-scoped occupancy
-- ==========================================================
-- Prod applied `apply_building_layout` in two steps: the base function
-- (20260902080254) and this follow-up, which was hotfixed straight onto the
-- database and never committed. The repo's 20260902080254 file already bakes
-- in the final (faculty-scoped) body, so a fresh `db reset` produces the same
-- function either way — this migration only re-aligns the local migration
-- history with what prod's schema_migrations already records. Re-running the
-- identical CREATE OR REPLACE is a harmless no-op.
--
-- Fix it carries: `_occ` (occupancy) counts a NULL-dorm_id resident/permit
-- only when that row's faculty maps to THIS dorm, so a same-numbered room in
-- another faculty's building (room "14" exists in several) is not a false
-- "occupied" hit that would wrongly pin/refuse a renumber.

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
  SELECT l.room_number, l.floor_number, l.side, l.size, l.frozen, l.frozen_reason, l.capacity,
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
           c.side, c.size, c.frozen, c.frozen_reason, c.capacity
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
           m.side, m.size, m.frozen, m.frozen_reason, m.capacity
    FROM movable m
    JOIN avail a ON a.floor = m.floor_number AND a.idx = m.idx
  ),
  fresh AS (
    SELECT a.floor, a.num, NULL::text AS old_number,
           CASE WHEN a.idx % 2 = 1 THEN 'left' ELSE 'right' END AS side,
           'medium'::text AS size, false AS frozen, NULL::text AS frozen_reason,
           NULL::smallint AS capacity
    FROM avail a
    WHERE a.idx > (SELECT COALESCE(max(m.idx), 0) FROM movable m WHERE m.floor_number = a.floor)
  )
  SELECT floor, num::text AS room_number, old_number, side, size, frozen, frozen_reason, capacity,
         'pin'::text AS kind FROM pinned
  UNION ALL
  SELECT floor, num::text, old_number, side, size, frozen, frozen_reason, capacity, 'renum' FROM renum
  UNION ALL
  SELECT floor, num::text, old_number, side, size, frozen, frozen_reason, capacity, 'new' FROM fresh;

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
    (dorm_id, faculty, floor_number, room_number, side, position, size, frozen, frozen_reason, capacity)
  SELECT v_dorm_id, p_faculty, n.floor, n.room_number, n.side,
         (row_number() OVER (PARTITION BY n.floor, n.side ORDER BY (n.room_number)::int))::int - 1,
         n.size, n.frozen, n.frozen_reason, n.capacity
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
