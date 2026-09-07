-- ==========================================================
-- 6-yotoqxona (bo'lingan bino) — 1-bosqich: BLOK-AWARE RPC lar
-- ==========================================================
-- P0 (202609300010) sxemani qo'ydi. Bu migratsiya:
--   • assign_student_room_atomic / assign_permit_room_atomic ga
--     p_block + p_floor qo'shadi va dorms.layout_kind bo'yicha tarmoqlaydi.
--     'simple' bino uchun yo'l AYNAN avvalgidek — p_block/p_floor e'tiborsiz.
--   • dorm_build_blocked_layout — 12 qavat × N blok × 9 xona shablonini
--     qat'iy sig'im profili bilan yaratadi (1→4, 5→8, qolgani→6), idempotent.
--   • dorm_assign_section / dorm_clear_section — superadmin seksiya egaligini
--     (blok+qavat = 1 fakultet) o'rnatadi / tozalaydi.
--
-- approve_permit_room_atomic O'ZGARMAYDI — u o'lik kod (hech qaysi trigger
-- uni chaqirmaydi; yagona yo'l features/room-assignment/service.ts).
--
-- Hali hech qanday ilova kodi p_block/p_floor ni UZATMAYDI, shuning uchun
-- xatti-harakat o'zgarmaydi. Simlanishi P2 (backend) da.
-- Reja: https://claude.ai/code/artifact/17d5c605-3402-413c-bd33-a40fa21d1f5b

-- ----------------------------------------------------------
-- 0. permit_requests.assigned_floor — blocked binoda arizaning qavati
-- ----------------------------------------------------------
-- 'blocked' binoda xona raqami ("5") har qavatда takrorlanadi, shuning uchun
-- tasdiqlangan arizaning bandligini sanashда qavat ham kerak. users.assigned_floor
-- bilan bir xil. 'simple' binoда NULL qoladi — hech kim o'qimaydi.
ALTER TABLE public.permit_requests ADD COLUMN IF NOT EXISTS assigned_floor int;

-- ==========================================================
-- 1. assign_student_room_atomic — blok-aware
-- ==========================================================
DROP FUNCTION IF EXISTS public.assign_student_room_atomic(uuid, text, integer, uuid);

CREATE FUNCTION public.assign_student_room_atomic(
  p_student_id uuid,
  p_room_number text,
  p_max_capacity integer DEFAULT 4,
  p_dorm_id uuid DEFAULT NULL,
  p_block text DEFAULT NULL,
  p_floor integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_faculty text; v_gender text; v_row_dorm uuid; v_dorm_id uuid;
  v_layout text; v_block_count smallint;
  v_block text; v_floor int;
  v_owner text; v_section_gender text;
  v_frozen boolean; v_room_capacity smallint; v_room_gender text;
  v_occupied int; v_conflicting int;
BEGIN
  SELECT COALESCE(NULLIF(faculty, ''), 'amit'), gender, dorm_id
  INTO v_faculty, v_gender, v_row_dorm
  FROM public.users WHERE id = p_student_id AND role = 'talaba';
  IF NOT FOUND THEN RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0001'; END IF;

  IF p_dorm_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.faculty_dorm WHERE faculty = v_faculty AND dorm_id = p_dorm_id) THEN
      RAISE EXCEPTION 'Dorm % does not belong to faculty %', p_dorm_id, v_faculty USING ERRCODE = 'P0002';
    END IF;
    v_dorm_id := p_dorm_id;
  ELSE
    v_dorm_id := COALESCE(v_row_dorm, (SELECT dorm_id FROM public.faculty_dorm WHERE faculty = v_faculty AND is_primary));
  END IF;
  IF v_dorm_id IS NULL THEN RAISE EXCEPTION 'No dorm for faculty %', v_faculty USING ERRCODE = 'P0002'; END IF;

  SELECT layout_kind, block_count INTO v_layout, v_block_count
  FROM public.dorms WHERE id = v_dorm_id;

  -- ============ BLOCKED BINO (blok + qavat + xona) ============
  IF v_layout = 'blocked' THEN
    IF p_block IS NULL OR p_floor IS NULL THEN
      RAISE EXCEPTION 'Block and floor are required for this building' USING ERRCODE = 'P0002';
    END IF;
    v_block := upper(btrim(p_block));
    IF v_block !~ '^[A-Z]$' OR v_block > chr(64 + v_block_count) THEN
      RAISE EXCEPTION 'Invalid block %', p_block USING ERRCODE = 'P0002';
    END IF;
    v_floor := p_floor;

    PERFORM pg_advisory_xact_lock(hashtext(
      v_dorm_id::text || ':' || v_block || ':' || v_floor::text || ':' || p_room_number));

    SELECT frozen, capacity, gender INTO v_frozen, v_room_capacity, v_room_gender
    FROM public.floor_room_layout
    WHERE dorm_id = v_dorm_id AND block = v_block
      AND floor_number = v_floor AND room_number = p_room_number;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002'; END IF;
    IF v_frozen THEN RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004'; END IF;

    -- Egalik: seksiya jadvalidan (qavat egaligi emas).
    SELECT faculty, gender INTO v_owner, v_section_gender FROM public.dorm_section
    WHERE dorm_id = v_dorm_id AND block = v_block AND floor_number = v_floor;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Section %/% is not assigned to any faculty', v_block, v_floor USING ERRCODE = 'P0007';
    END IF;
    IF v_owner IS DISTINCT FROM v_faculty THEN
      RAISE EXCEPTION 'Section belongs to another faculty' USING ERRCODE = 'P0007';
    END IF;

    IF v_section_gender IS NOT NULL AND v_gender IS NOT NULL AND v_section_gender <> v_gender THEN
      RAISE EXCEPTION 'Section reserved for other gender' USING ERRCODE = 'P0001';
    END IF;
    IF v_room_gender IS NOT NULL AND v_gender IS NOT NULL AND v_room_gender <> v_gender THEN
      RAISE EXCEPTION 'Room reserved for other gender' USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*) INTO v_occupied FROM (
      SELECT id FROM public.users
      WHERE role = 'talaba' AND dorm_id = v_dorm_id AND block = v_block
        AND assigned_floor = v_floor AND room_number = p_room_number AND id <> p_student_id
      UNION ALL
      SELECT pr.id FROM public.permit_requests pr
      WHERE pr.status = 'approved' AND pr.dorm_id = v_dorm_id AND pr.block = v_block
        AND pr.assigned_floor = v_floor AND pr.room_number = p_room_number
        AND NOT EXISTS (
          SELECT 1 FROM public.users u WHERE u.role = 'talaba'
            AND ((u.passport_series IS NOT NULL AND u.passport_series = pr.passport_series)
              OR (u.jshshir IS NOT NULL AND pr.jshshir IS NOT NULL AND u.jshshir = pr.jshshir)))
    ) occ;
    IF v_occupied >= COALESCE(v_room_capacity, p_max_capacity) THEN
      RAISE EXCEPTION 'Room is full' USING ERRCODE = 'P0001';
    END IF;

    IF v_gender IS NOT NULL THEN
      SELECT count(*) INTO v_conflicting FROM (
        SELECT gender FROM public.users
        WHERE role = 'talaba' AND dorm_id = v_dorm_id AND block = v_block
          AND assigned_floor = v_floor AND room_number = p_room_number
          AND id <> p_student_id AND gender IS NOT NULL
        UNION ALL
        SELECT gender FROM public.permit_requests
        WHERE status = 'approved' AND dorm_id = v_dorm_id AND block = v_block
          AND assigned_floor = v_floor AND room_number = p_room_number AND gender IS NOT NULL
      ) g WHERE g.gender <> v_gender;
      IF v_conflicting > 0 THEN RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001'; END IF;
    END IF;

    UPDATE public.users
    SET room_number = p_room_number, dorm_id = v_dorm_id, block = v_block, assigned_floor = v_floor
    WHERE id = p_student_id;
    RETURN;
  END IF;

  -- ============ SIMPLE BINO (o'zgarmagan yo'l) ============
  PERFORM pg_advisory_xact_lock(hashtext(v_dorm_id::text || ':' || p_room_number));

  SELECT floor_number, frozen, capacity, gender INTO v_floor, v_frozen, v_room_capacity, v_room_gender
  FROM public.floor_room_layout
  WHERE dorm_id = v_dorm_id AND room_number = p_room_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002'; END IF;
  IF v_frozen THEN RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004'; END IF;

  IF v_room_gender IS NOT NULL AND v_gender IS NOT NULL AND v_room_gender <> v_gender THEN
    RAISE EXCEPTION 'Room reserved for other gender' USING ERRCODE = 'P0001';
  END IF;

  SELECT faculty INTO v_owner FROM public.dorm_floor
  WHERE dorm_id = v_dorm_id AND floor_number = v_floor;
  IF FOUND AND v_owner IS DISTINCT FROM v_faculty THEN
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
          AND ((u.passport_series IS NOT NULL AND u.passport_series = pr.passport_series)
            OR (u.jshshir IS NOT NULL AND pr.jshshir IS NOT NULL AND u.jshshir = pr.jshshir)))
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

REVOKE ALL ON FUNCTION public.assign_student_room_atomic(uuid, text, integer, uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_student_room_atomic(uuid, text, integer, uuid, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_student_room_atomic(uuid, text, integer, uuid, text, integer) TO service_role;

-- ==========================================================
-- 2. assign_permit_room_atomic — blok-aware
-- ==========================================================
DROP FUNCTION IF EXISTS public.assign_permit_room_atomic(uuid, text, integer, uuid);

CREATE FUNCTION public.assign_permit_room_atomic(
  p_permit_id uuid,
  p_room_number text,
  p_max_capacity integer DEFAULT 4,
  p_dorm_id uuid DEFAULT NULL,
  p_block text DEFAULT NULL,
  p_floor integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_faculty text; v_gender text; v_row_dorm uuid; v_dorm_id uuid;
  v_layout text; v_block_count smallint;
  v_block text; v_floor int;
  v_owner text; v_section_gender text; v_floor_owner text;
  v_frozen boolean; v_room_capacity smallint; v_room_gender text;
  v_occupied int; v_conflicting int;
BEGIN
  SELECT COALESCE(NULLIF(faculty, ''), 'amit'), dorm_id INTO v_faculty, v_row_dorm
  FROM public.permit_requests WHERE id = p_permit_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permit not approved' USING ERRCODE = 'P0005'; END IF;

  IF p_dorm_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.faculty_dorm WHERE faculty = v_faculty AND dorm_id = p_dorm_id) THEN
      RAISE EXCEPTION 'Dorm % does not belong to faculty %', p_dorm_id, v_faculty USING ERRCODE = 'P0002';
    END IF;
    v_dorm_id := p_dorm_id;
  ELSE
    v_dorm_id := COALESCE(v_row_dorm, (SELECT dorm_id FROM public.faculty_dorm WHERE faculty = v_faculty AND is_primary));
  END IF;
  IF v_dorm_id IS NULL THEN RAISE EXCEPTION 'No dorm for faculty %', v_faculty USING ERRCODE = 'P0002'; END IF;

  -- Arizani band qilamiz + jinsni olamiz (holat 'approved' bo'lishi shart).
  SELECT gender INTO v_gender FROM public.permit_requests
  WHERE id = p_permit_id AND status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Permit not approved' USING ERRCODE = 'P0005'; END IF;

  SELECT layout_kind, block_count INTO v_layout, v_block_count
  FROM public.dorms WHERE id = v_dorm_id;

  -- ============ BLOCKED BINO ============
  IF v_layout = 'blocked' THEN
    IF p_block IS NULL OR p_floor IS NULL THEN
      RAISE EXCEPTION 'Block and floor are required for this building' USING ERRCODE = 'P0002';
    END IF;
    v_block := upper(btrim(p_block));
    IF v_block !~ '^[A-Z]$' OR v_block > chr(64 + v_block_count) THEN
      RAISE EXCEPTION 'Invalid block %', p_block USING ERRCODE = 'P0002';
    END IF;
    v_floor := p_floor;

    PERFORM pg_advisory_xact_lock(hashtext(
      v_dorm_id::text || ':' || v_block || ':' || v_floor::text || ':' || p_room_number));

    SELECT frozen, capacity, gender INTO v_frozen, v_room_capacity, v_room_gender
    FROM public.floor_room_layout
    WHERE dorm_id = v_dorm_id AND block = v_block
      AND floor_number = v_floor AND room_number = p_room_number;
    IF NOT FOUND THEN RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002'; END IF;
    IF v_frozen THEN RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004'; END IF;

    SELECT faculty, gender INTO v_owner, v_section_gender FROM public.dorm_section
    WHERE dorm_id = v_dorm_id AND block = v_block AND floor_number = v_floor;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Section %/% is not assigned to any faculty', v_block, v_floor USING ERRCODE = 'P0007';
    END IF;
    IF v_owner IS DISTINCT FROM v_faculty THEN
      RAISE EXCEPTION 'Section belongs to another faculty' USING ERRCODE = 'P0007';
    END IF;

    IF v_section_gender IS NOT NULL AND v_gender IS NOT NULL AND v_section_gender <> v_gender THEN
      RAISE EXCEPTION 'Section reserved for other gender' USING ERRCODE = 'P0001';
    END IF;
    IF v_room_gender IS NOT NULL AND v_gender IS NOT NULL AND v_room_gender <> v_gender THEN
      RAISE EXCEPTION 'Room reserved for other gender' USING ERRCODE = 'P0001';
    END IF;

    SELECT count(*) INTO v_occupied FROM (
      SELECT id FROM public.users
      WHERE role = 'talaba' AND dorm_id = v_dorm_id AND block = v_block
        AND assigned_floor = v_floor AND room_number = p_room_number
      UNION ALL
      SELECT pr.id FROM public.permit_requests pr
      WHERE pr.status = 'approved' AND pr.dorm_id = v_dorm_id AND pr.block = v_block
        AND pr.assigned_floor = v_floor AND pr.room_number = p_room_number AND pr.id <> p_permit_id
        AND NOT EXISTS (
          SELECT 1 FROM public.users u WHERE u.role = 'talaba'
            AND ((u.passport_series IS NOT NULL AND u.passport_series = pr.passport_series)
              OR (u.jshshir IS NOT NULL AND pr.jshshir IS NOT NULL AND u.jshshir = pr.jshshir)))
    ) occ;
    IF v_occupied >= COALESCE(v_room_capacity, p_max_capacity) THEN
      RAISE EXCEPTION 'Room is full' USING ERRCODE = 'P0001';
    END IF;

    IF v_gender IS NOT NULL THEN
      SELECT count(*) INTO v_conflicting FROM (
        SELECT gender FROM public.users
        WHERE role = 'talaba' AND dorm_id = v_dorm_id AND block = v_block
          AND assigned_floor = v_floor AND room_number = p_room_number AND gender IS NOT NULL
        UNION ALL
        SELECT gender FROM public.permit_requests
        WHERE status = 'approved' AND dorm_id = v_dorm_id AND block = v_block
          AND assigned_floor = v_floor AND room_number = p_room_number
          AND id <> p_permit_id AND gender IS NOT NULL
      ) g WHERE g.gender <> v_gender;
      IF v_conflicting > 0 THEN RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001'; END IF;
    END IF;

    UPDATE public.permit_requests
    SET room_number = p_room_number, dorm_id = v_dorm_id, block = v_block,
        assigned_floor = v_floor, updated_at = now()
    WHERE id = p_permit_id AND status = 'approved';

    UPDATE public.users u
    SET room_number = p_room_number, dorm_id = v_dorm_id, block = v_block,
        assigned_floor = v_floor, updated_at = now()
    FROM public.permit_requests pr
    WHERE pr.id = p_permit_id
      AND u.role = 'talaba' AND u.status = 'pending' AND u.room_number IS NULL
      AND u.passport_series = pr.passport_series
      AND lower(trim(u.email)) = lower(trim(pr.email))
      AND ((pr.jshshir IS NOT NULL AND u.jshshir = pr.jshshir)
        OR (pr.jshshir IS NULL AND u.jshshir IS NULL));
    RETURN;
  END IF;

  -- ============ SIMPLE BINO (o'zgarmagan yo'l) ============
  PERFORM pg_advisory_xact_lock(hashtext(v_dorm_id::text || ':' || p_room_number));

  SELECT floor_number, frozen, capacity, gender INTO v_floor, v_frozen, v_room_capacity, v_room_gender
  FROM public.floor_room_layout
  WHERE dorm_id = v_dorm_id AND room_number = p_room_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002'; END IF;
  IF v_frozen THEN RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004'; END IF;

  SELECT faculty INTO v_floor_owner FROM public.dorm_floor
  WHERE dorm_id = v_dorm_id AND floor_number = v_floor;
  IF FOUND AND v_floor_owner IS DISTINCT FROM v_faculty THEN
    RAISE EXCEPTION 'Room is on another faculty''s floor' USING ERRCODE = 'P0007';
  END IF;

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
          AND ((u.passport_series IS NOT NULL AND u.passport_series = pr.passport_series)
            OR (u.jshshir IS NOT NULL AND pr.jshshir IS NOT NULL AND u.jshshir = pr.jshshir)))
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

REVOKE ALL ON FUNCTION public.assign_permit_room_atomic(uuid, text, integer, uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, integer, uuid, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, integer, uuid, text, integer) TO service_role;

-- ==========================================================
-- 3. dorm_build_blocked_layout — qat'iy 9-xona shabloni
-- ==========================================================
-- Har blok/qavat = 9 xona. Sig'im: 1→4, 5→8, qolgani→6 (rasm bo'yicha).
-- Koridor: 1,3,7,9 → o'ng; 2,4,5,6,8 → chap. Idempotent (NOT EXISTS).
-- Xona faculty'si — seksiya egasi bo'lsa u, aks holda binoning is_primary
-- fakulteti (keyin dorm_assign_section sinxronlaydi).
CREATE OR REPLACE FUNCTION public.dorm_build_blocked_layout(p_dorm_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_layout text; v_blocks smallint; v_floors int; v_primary text;
  v_created int := 0; v_inserted int;
  b int; f int; r int;
  v_block text; v_cap smallint; v_side text; v_pos int; v_fac text;
BEGIN
  SELECT layout_kind, block_count, floor_count INTO v_layout, v_blocks, v_floors
  FROM public.dorms WHERE id = p_dorm_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dorm not found' USING ERRCODE = 'P0002'; END IF;
  IF v_layout <> 'blocked' THEN
    RAISE EXCEPTION 'Dorm is not a blocked-layout building' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_dorm_id::text || ':layout'));

  SELECT faculty INTO v_primary FROM public.faculty_dorm
  WHERE dorm_id = p_dorm_id AND is_primary;
  v_primary := COALESCE(v_primary, 'amit');

  FOR b IN 1..v_blocks LOOP
    v_block := chr(64 + b);
    FOR f IN 1..v_floors LOOP
      SELECT faculty INTO v_fac FROM public.dorm_section
      WHERE dorm_id = p_dorm_id AND block = v_block AND floor_number = f;
      v_fac := COALESCE(v_fac, v_primary);

      FOR r IN 1..9 LOOP
        v_cap  := CASE r WHEN 1 THEN 4 WHEN 5 THEN 8 ELSE 6 END;
        v_side := CASE WHEN r IN (1, 3, 7, 9) THEN 'right' ELSE 'left' END;
        v_pos  := CASE
          WHEN r IN (1, 3, 7, 9) THEN array_position(ARRAY[1, 3, 7, 9], r)
          ELSE array_position(ARRAY[2, 4, 5, 6, 8], r)
        END;

        INSERT INTO public.floor_room_layout
          (dorm_id, faculty, block, floor_number, room_number, side, position, size, capacity)
        SELECT p_dorm_id, v_fac, v_block, f, r::text, v_side, v_pos, 'medium', v_cap
        WHERE NOT EXISTS (
          SELECT 1 FROM public.floor_room_layout
          WHERE dorm_id = p_dorm_id AND block = v_block
            AND floor_number = f AND room_number = r::text
        );
        GET DIAGNOSTICS v_inserted = ROW_COUNT;
        v_created := v_created + v_inserted;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'created', v_created, 'blocks', v_blocks, 'floors', v_floors, 'rooms_per_section', 9);
END;
$$;

REVOKE ALL ON FUNCTION public.dorm_build_blocked_layout(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dorm_build_blocked_layout(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dorm_build_blocked_layout(uuid) TO service_role;

-- ==========================================================
-- 4. dorm_assign_section — seksiya egaligini o'rnatish
-- ==========================================================
CREATE OR REPLACE FUNCTION public.dorm_assign_section(
  p_dorm_id uuid, p_block text, p_floor int, p_faculty text, p_staff_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_layout text; v_blocks smallint; v_floors int; v_block text; v_conflict int;
BEGIN
  IF p_dorm_id IS NULL OR p_block IS NULL OR p_floor IS NULL
     OR p_faculty IS NULL OR btrim(p_faculty) = '' THEN
    RAISE EXCEPTION 'Invalid arguments' USING ERRCODE = '22023';
  END IF;

  SELECT layout_kind, block_count, floor_count INTO v_layout, v_blocks, v_floors
  FROM public.dorms WHERE id = p_dorm_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dorm not found' USING ERRCODE = 'P0002'; END IF;
  IF v_layout <> 'blocked' THEN
    RAISE EXCEPTION 'Dorm is not a blocked-layout building' USING ERRCODE = 'P0001';
  END IF;

  v_block := upper(btrim(p_block));
  IF v_block !~ '^[A-Z]$' OR v_block > chr(64 + v_blocks) THEN
    RAISE EXCEPTION 'Block % is outside A..%', p_block, chr(64 + v_blocks) USING ERRCODE = '22023';
  END IF;
  IF p_floor < 1 OR p_floor > v_floors THEN
    RAISE EXCEPTION 'Floor % is outside 1..%', p_floor, v_floors USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_dorm_id::text || ':section'));

  SELECT count(*) INTO v_conflict FROM public.users
  WHERE role = 'talaba' AND dorm_id = p_dorm_id AND block = v_block
    AND assigned_floor = p_floor
    AND COALESCE(NULLIF(btrim(faculty), ''), 'amit') <> p_faculty;
  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'Section %/% still has % resident(s) from another faculty', v_block, p_floor, v_conflict
      USING ERRCODE = 'P0003';
  END IF;

  INSERT INTO public.dorm_section (dorm_id, block, floor_number, faculty, assigned_by)
  VALUES (p_dorm_id, v_block, p_floor, p_faculty, p_staff_id)
  ON CONFLICT (dorm_id, block, floor_number) DO UPDATE SET
    faculty = EXCLUDED.faculty, assigned_by = EXCLUDED.assigned_by, updated_at = now();

  -- floor_room_layout.faculty ni seksiya egasiga tenglashtiramiz (o'qish qulayligi).
  UPDATE public.floor_room_layout
  SET faculty = p_faculty
  WHERE dorm_id = p_dorm_id AND block = v_block AND floor_number = p_floor
    AND faculty <> p_faculty;

  RETURN jsonb_build_object('block', v_block, 'floor', p_floor, 'faculty', p_faculty);
END;
$$;

REVOKE ALL ON FUNCTION public.dorm_assign_section(uuid, text, int, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dorm_assign_section(uuid, text, int, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dorm_assign_section(uuid, text, int, text, uuid) TO service_role;

-- ==========================================================
-- 5. dorm_clear_section — seksiya egaligini bo'shatish (bo'sh bo'lsa)
-- ==========================================================
CREATE OR REPLACE FUNCTION public.dorm_clear_section(
  p_dorm_id uuid, p_block text, p_floor int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_block text; v_residents int;
BEGIN
  IF p_dorm_id IS NULL OR p_block IS NULL OR p_floor IS NULL THEN
    RAISE EXCEPTION 'Invalid arguments' USING ERRCODE = '22023';
  END IF;
  v_block := upper(btrim(p_block));

  PERFORM pg_advisory_xact_lock(hashtext(p_dorm_id::text || ':section'));

  SELECT count(*) INTO v_residents FROM public.users
  WHERE role = 'talaba' AND dorm_id = p_dorm_id AND block = v_block AND assigned_floor = p_floor;
  IF v_residents > 0 THEN
    RAISE EXCEPTION 'Section %/% still has % resident(s)', v_block, p_floor, v_residents USING ERRCODE = 'P0003';
  END IF;

  DELETE FROM public.dorm_section
  WHERE dorm_id = p_dorm_id AND block = v_block AND floor_number = p_floor;

  RETURN jsonb_build_object('block', v_block, 'floor', p_floor, 'cleared', true);
END;
$$;

REVOKE ALL ON FUNCTION public.dorm_clear_section(uuid, text, int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dorm_clear_section(uuid, text, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dorm_clear_section(uuid, text, int) TO service_role;
