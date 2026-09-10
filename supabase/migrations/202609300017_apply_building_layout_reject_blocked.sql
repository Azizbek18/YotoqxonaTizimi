-- ==========================================================
-- apply_building_layout — blokli binoni RAD ETADI (P0001)
-- ==========================================================
-- Bu — oddiy ('simple') binolarning qavat-bo'yicha xona generatori.
-- Blokli bino (`dorms.layout_kind = 'blocked'`) xonalari `dorm_build_blocked_layout`
-- bilan (blok + qavat + 1–9 raqamlash) yaratiladi. Ilgari bu funksiya
-- layout_kind ni tekshirmasди — natijada blokli 7-yotoqxonaga 339 ta noto'g'ri
-- "oddiy" xona (block IS NULL) yaratilib qolgan edi. Endi darhol P0001 bilan
-- to'xtaydi. Qolgan tanasi 202609300016 bilan bir xil.

CREATE OR REPLACE FUNCTION public.apply_building_layout(
  p_faculty text,
  p_numbering text,
  p_floors jsonb,
  p_dorm_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  IF p_dorm_id IS NOT NULL THEN
    SELECT dorm_id INTO v_dorm_id FROM public.faculty_dorm WHERE faculty = p_faculty AND dorm_id = p_dorm_id;
    IF v_dorm_id IS NULL THEN
      RAISE EXCEPTION 'Dorm % does not belong to faculty %', p_dorm_id, p_faculty USING ERRCODE = 'P0002';
    END IF;
  ELSE
    SELECT dorm_id INTO v_dorm_id FROM public.faculty_dorm WHERE faculty = p_faculty AND is_primary;
    IF v_dorm_id IS NULL THEN
      RAISE EXCEPTION 'No dorm for faculty %', p_faculty USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- A blocked-layout building is not managed here (see dorm_build_blocked_layout).
  IF (SELECT layout_kind FROM public.dorms WHERE id = v_dorm_id) = 'blocked' THEN
    RAISE EXCEPTION 'Dorm % is a blocked-layout building', v_dorm_id USING ERRCODE = 'P0001';
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
             AND (SELECT fd.dorm_id FROM public.faculty_dorm fd WHERE fd.faculty = u.faculty AND fd.is_primary) = v_dorm_id))
    UNION
    SELECT p.room_number FROM public.permit_requests p
      WHERE p.status = 'approved' AND p.room_number IS NOT NULL
        AND (p.dorm_id = v_dorm_id OR (p.dorm_id IS NULL
             AND (SELECT fd.dorm_id FROM public.faculty_dorm fd WHERE fd.faculty = p.faculty AND fd.is_primary) = v_dorm_id));

  -- Har qavatдаги mavjud harfli xonalar soni — plan.rooms dan chiqarилади.
  CREATE TEMP TABLE _lettered ON COMMIT DROP AS
    SELECT l.floor_number AS floor, count(*)::int AS n
    FROM public.floor_room_layout l
    WHERE l.dorm_id = v_dorm_id
      AND l.room_number !~ '^[0-9]+$'
      AND l.floor_number IN (SELECT (e->>'floor')::int FROM jsonb_array_elements(p_floors) e)
    GROUP BY l.floor_number;

  CREATE TEMP TABLE _range ON COMMIT DROP AS
  SELECT floor, rooms, num_target, lo, lo + num_target - 1 AS hi
  FROM (
    WITH plan AS (
      SELECT (e->>'floor')::int AS floor,
             GREATEST((e->>'rooms')::int, 0) AS rooms
      FROM jsonb_array_elements(p_floors) e
    ),
    -- Har qavatning "raqamli xona" sanog'i: rejадаgi qavat uchun reja soni
    -- (harfli minus), rejasiz qavat uchun hozirги raqamli xona soni.
    building AS (
      SELECT g.floor,
             CASE
               WHEN p.floor IS NOT NULL
                 THEN GREATEST(p.rooms - COALESCE(x.n, 0), 0)
               ELSE COALESCE((
                 SELECT count(*) FROM public.floor_room_layout l
                 WHERE l.dorm_id = v_dorm_id AND l.floor_number = g.floor
                   AND l.room_number ~ '^[0-9]+$'
               ), 0)
             END AS num_count
      FROM generate_series(1, COALESCE((SELECT floor_count FROM public.dorms WHERE id = v_dorm_id), 0)) AS g(floor)
      LEFT JOIN plan p ON p.floor = g.floor
      LEFT JOIN _lettered x ON x.floor = g.floor
    )
    SELECT p.floor, p.rooms,
           GREATEST(p.rooms - COALESCE(x.n, 0), 0) AS num_target,
           CASE WHEN p_numbering = 'per-floor'
             THEN p.floor * 100 + 1
             ELSE 1 + COALESCE((SELECT sum(b.num_count) FROM building b WHERE b.floor < p.floor), 0)
           END AS lo
    FROM plan p LEFT JOIN _lettered x ON x.floor = p.floor
  ) q;

  CREATE TEMP TABLE _cur ON COMMIT DROP AS
  SELECT l.room_number, l.floor_number, l.side, l.size, l.frozen, l.frozen_reason, l.capacity, l.gender,
         (l.room_number ~ '^[0-9]+$') AS is_num,
         CASE WHEN l.room_number ~ '^[0-9]+$' THEN l.room_number::int END AS rn,
         EXISTS (SELECT 1 FROM _occ o WHERE o.room_number = l.room_number) AS occupied
  FROM public.floor_room_layout l
  WHERE l.dorm_id = v_dorm_id
    AND l.floor_number IN (SELECT floor FROM _range);

  -- Konflikt: faqat SOF RAQAMLI band xona o'z diapazonига sig'masligi.
  SELECT string_agg(c.room_number, ', ' ORDER BY c.room_number) INTO v_conflicts
  FROM _cur c
  JOIN _range r ON r.floor = c.floor_number
  WHERE c.occupied AND c.is_num
    AND (
      c.rn < r.lo OR c.rn > r.hi
      OR (SELECT count(*) FROM _cur c2
          WHERE c2.floor_number = c.floor_number AND c2.occupied AND c2.is_num) > r.num_target
    );
  IF v_conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'Band xonalarni qayta raqamlab bo''lmadi: %', v_conflicts USING ERRCODE = 'P0003';
  END IF;

  CREATE TEMP TABLE _new ON COMMIT DROP AS
  WITH kept AS (   -- harfli xonalar: aynan o'zi qoladi
    SELECT c.floor_number AS floor, c.room_number AS num_text, c.room_number AS old_number,
           c.side, c.size, c.frozen, c.frozen_reason, c.capacity, c.gender
    FROM _cur c WHERE NOT c.is_num
  ),
  pinned AS (   -- band + raqamli: raqami saqlanadi
    SELECT c.floor_number AS floor, c.rn AS num, c.room_number AS old_number,
           c.side, c.size, c.frozen, c.frozen_reason, c.capacity, c.gender
    FROM _cur c WHERE c.occupied AND c.is_num
  ),
  avail AS (
    SELECT r.floor, g AS num,
           row_number() OVER (PARTITION BY r.floor ORDER BY g) AS idx
    FROM _range r
    CROSS JOIN LATERAL generate_series(r.lo, r.hi) AS g
    WHERE NOT EXISTS (SELECT 1 FROM pinned p WHERE p.floor = r.floor AND p.num = g)
  ),
  movable AS (   -- bo'sh + raqamli: qayta raqamlanadi
    SELECT c.*, row_number() OVER (PARTITION BY c.floor_number
             ORDER BY c.rn NULLS LAST, c.room_number) AS idx
    FROM _cur c WHERE NOT c.occupied AND c.is_num
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
  SELECT floor, num_text AS room_number, old_number, side, size, frozen, frozen_reason, capacity, gender,
         'keep'::text AS kind FROM kept
  UNION ALL
  SELECT floor, num::text, old_number, side, size, frozen, frozen_reason, capacity, gender, 'pin' FROM pinned
  UNION ALL
  SELECT floor, num::text, old_number, side, size, frozen, frozen_reason, capacity, gender, 'renum' FROM renum
  UNION ALL
  SELECT floor, num::text, old_number, side, size, frozen, frozen_reason, capacity, gender, 'new' FROM fresh;

  SELECT count(*) FILTER (WHERE kind = 'new'),
         count(*) FILTER (WHERE kind = 'renum' AND room_number IS DISTINCT FROM old_number)
    INTO v_created, v_renumbered
  FROM _new;
  SELECT count(*) INTO v_removed
  FROM _cur c WHERE NOT c.occupied AND c.is_num
    AND NOT EXISTS (SELECT 1 FROM _new n WHERE n.old_number = c.room_number);

  DELETE FROM public.floor_room_layout
  WHERE dorm_id = v_dorm_id AND floor_number IN (SELECT floor FROM _range);

  INSERT INTO public.floor_room_layout
    (dorm_id, faculty, floor_number, room_number, side, position, size, frozen, frozen_reason, capacity, gender)
  SELECT v_dorm_id,
         COALESCE(
           (SELECT df.faculty FROM public.dorm_floor df
            WHERE df.dorm_id = v_dorm_id AND df.floor_number = n.floor),
           p_faculty),
         n.floor, n.room_number, n.side,
         (row_number() OVER (
            PARTITION BY n.floor, n.side
            ORDER BY (n.room_number ~ '^[0-9]+$') DESC,
                     CASE WHEN n.room_number ~ '^[0-9]+$' THEN n.room_number::int END,
                     n.room_number
          ))::int - 1,
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
         AND (SELECT fd.dorm_id FROM public.faculty_dorm fd WHERE fd.faculty = u.faculty AND fd.is_primary) = v_dorm_id))
    AND u.assigned_floor IS DISTINCT FROM fl.floor_number;

  RETURN jsonb_build_object(
    'created', v_created,
    'removed', v_removed,
    'renumbered', v_renumbered
  );
END;
$function$;
