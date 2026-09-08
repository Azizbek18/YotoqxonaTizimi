-- ==========================================================
-- Xona-darajali fakultet istisnolari (dorm_room_grant)
-- ==========================================================
-- Muammo: `dorm_floor` modeli — 1 qavat butunligicha 1 fakultetники.
-- Amalда bo'lingan binoда (masalan 3-yotoqxona 2-qavat) bir fakultetning
-- bir necha xonasi boshqa qavat egasиникида joylashgan bo'lishi mumkin.
-- assign_*_room_atomic P0007 bilan buни to'sadi.
--
-- Yechim: `dorm_room_grant(dorm_id, room_number) -> faculty` — bino egasi
-- ALOHIDA xonalarni boshqa fakultetга "beradi". Grant bo'lsa u qavat
-- egaligидан USTUN turadi. Faqat 'simple' binolar uchun ('blocked' binolar
-- `dorm_section` bilan ishlaydi).
--
-- Idempotent. Faqat SIMPLE binoда grant qatori bo'lganда xatti-harakat
-- o'zgaradi — hech qanday mavjud grant yo'q, demak hozircha 0 o'zgarish.

-- ----------------------------------------------------------
-- 1. dorm_room_grant
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dorm_room_grant (
  dorm_id      uuid NOT NULL REFERENCES public.dorms(id) ON DELETE CASCADE,
  room_number  text NOT NULL,
  faculty      text NOT NULL,
  granted_by   uuid REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dorm_id, room_number)
);

CREATE INDEX IF NOT EXISTS dorm_room_grant_faculty_idx
  ON public.dorm_room_grant (dorm_id, faculty);

ALTER TABLE public.dorm_room_grant ENABLE ROW LEVEL SECURITY;
-- Mijozga ochiq policy yo'q — faqat service-role.

-- ----------------------------------------------------------
-- 2. assign_student_room_atomic — grant-aware simple branch
-- ----------------------------------------------------------
-- Imzo o'zgarmadi (6-arg) — CREATE OR REPLACE yetarli. Blocked branch
-- tegilmadi. Simple branch: qavat egaligidan oldin xona granti tekshiriladi.
CREATE OR REPLACE FUNCTION public.assign_student_room_atomic(
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
  v_owner text; v_section_gender text; v_room_grant text;
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

  -- ============ SIMPLE BINO ============
  PERFORM pg_advisory_xact_lock(hashtext(v_dorm_id::text || ':' || p_room_number));

  SELECT floor_number, frozen, capacity, gender INTO v_floor, v_frozen, v_room_capacity, v_room_gender
  FROM public.floor_room_layout
  WHERE dorm_id = v_dorm_id AND room_number = p_room_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002'; END IF;
  IF v_frozen THEN RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004'; END IF;

  IF v_room_gender IS NOT NULL AND v_gender IS NOT NULL AND v_room_gender <> v_gender THEN
    RAISE EXCEPTION 'Room reserved for other gender' USING ERRCODE = 'P0001';
  END IF;

  -- Xona granti (dorm_room_grant) qavat egaligидан USTUN: bino egasи
  -- ayrim xonalarni boshqa fakultetга bergan bo'lishi mumkin. Grant yo'q
  -- bo'lсагina avvalgi qavat-egaligi tekshiriladi.
  SELECT faculty INTO v_room_grant FROM public.dorm_room_grant
  WHERE dorm_id = v_dorm_id AND room_number = p_room_number;
  IF v_room_grant IS NOT NULL THEN
    IF v_room_grant IS DISTINCT FROM v_faculty THEN
      RAISE EXCEPTION 'Room is granted to another faculty' USING ERRCODE = 'P0007';
    END IF;
  ELSE
    SELECT faculty INTO v_owner FROM public.dorm_floor
    WHERE dorm_id = v_dorm_id AND floor_number = v_floor;
    IF FOUND AND v_owner IS DISTINCT FROM v_faculty THEN
      RAISE EXCEPTION 'Room is on another faculty''s floor' USING ERRCODE = 'P0007';
    END IF;
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

-- ----------------------------------------------------------
-- 3. assign_permit_room_atomic — grant-aware simple branch
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_permit_room_atomic(
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
  v_owner text; v_section_gender text; v_floor_owner text; v_room_grant text;
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

  -- ============ SIMPLE BINO ============
  PERFORM pg_advisory_xact_lock(hashtext(v_dorm_id::text || ':' || p_room_number));

  SELECT floor_number, frozen, capacity, gender INTO v_floor, v_frozen, v_room_capacity, v_room_gender
  FROM public.floor_room_layout
  WHERE dorm_id = v_dorm_id AND room_number = p_room_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002'; END IF;
  IF v_frozen THEN RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004'; END IF;

  -- Xona granti qavat egaligидан USTUN (dorm_room_grant, yuqoridagi izoh).
  SELECT faculty INTO v_room_grant FROM public.dorm_room_grant
  WHERE dorm_id = v_dorm_id AND room_number = p_room_number;
  IF v_room_grant IS NOT NULL THEN
    IF v_room_grant IS DISTINCT FROM v_faculty THEN
      RAISE EXCEPTION 'Room is granted to another faculty' USING ERRCODE = 'P0007';
    END IF;
  ELSE
    SELECT faculty INTO v_floor_owner FROM public.dorm_floor
    WHERE dorm_id = v_dorm_id AND floor_number = v_floor;
    IF FOUND AND v_floor_owner IS DISTINCT FROM v_faculty THEN
      RAISE EXCEPTION 'Room is on another faculty''s floor' USING ERRCODE = 'P0007';
    END IF;
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

-- ----------------------------------------------------------
-- 4. dorm_grant_room / dorm_ungrant_room — istisnoni boshqarish
-- ----------------------------------------------------------
-- Superadmin (yoki bino egasi dekan) ayrim xonani boshqa fakultetга beradi.
-- Grantee fakultet dekani binoni ko'rishi uchun faculty_dorm bog'lanishi
-- ham yaratiladi (is_primary=false). floor_room_layout.faculty ham sinxron.
CREATE OR REPLACE FUNCTION public.dorm_grant_room(
  p_dorm_id uuid, p_room_number text, p_faculty text, p_staff_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_layout text; v_floor int; v_conflict int;
BEGIN
  IF p_dorm_id IS NULL OR p_room_number IS NULL OR btrim(p_room_number) = ''
     OR p_faculty IS NULL OR btrim(p_faculty) = '' THEN
    RAISE EXCEPTION 'Invalid arguments' USING ERRCODE = '22023';
  END IF;

  SELECT layout_kind INTO v_layout FROM public.dorms WHERE id = p_dorm_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dorm not found' USING ERRCODE = 'P0002'; END IF;
  IF v_layout = 'blocked' THEN
    RAISE EXCEPTION 'Blocked dorms use dorm_section, not room grants' USING ERRCODE = 'P0001';
  END IF;

  SELECT floor_number INTO v_floor FROM public.floor_room_layout
  WHERE dorm_id = p_dorm_id AND room_number = p_room_number;
  IF NOT FOUND THEN RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002'; END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_dorm_id::text || ':grant'));

  -- Boshqa fakultetning yashovchisi shu xonaда bo'lsa — bloklaymiz.
  SELECT count(*) INTO v_conflict FROM (
    SELECT id FROM public.users
    WHERE role = 'talaba' AND dorm_id = p_dorm_id AND room_number = p_room_number
      AND COALESCE(NULLIF(btrim(faculty), ''), 'amit') <> p_faculty
    UNION ALL
    SELECT id FROM public.permit_requests
    WHERE status = 'approved' AND dorm_id = p_dorm_id AND room_number = p_room_number
      AND COALESCE(NULLIF(btrim(faculty), ''), 'amit') <> p_faculty
  ) x;
  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'Room % still has % resident(s) from another faculty', p_room_number, v_conflict
      USING ERRCODE = 'P0003';
  END IF;

  -- Grantee dekani binoni ko'ra olsin.
  INSERT INTO public.faculty_dorm (faculty, dorm_id, is_primary)
  VALUES (p_faculty, p_dorm_id, false)
  ON CONFLICT (faculty, dorm_id) DO NOTHING;

  INSERT INTO public.dorm_room_grant (dorm_id, room_number, faculty, granted_by)
  VALUES (p_dorm_id, p_room_number, p_faculty, p_staff_id)
  ON CONFLICT (dorm_id, room_number) DO UPDATE SET
    faculty = EXCLUDED.faculty, granted_by = EXCLUDED.granted_by, updated_at = now();

  UPDATE public.floor_room_layout
  SET faculty = p_faculty
  WHERE dorm_id = p_dorm_id AND room_number = p_room_number AND faculty <> p_faculty;

  RETURN jsonb_build_object('room', p_room_number, 'floor', v_floor, 'faculty', p_faculty);
END;
$$;

CREATE OR REPLACE FUNCTION public.dorm_ungrant_room(p_dorm_id uuid, p_room_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_floor int; v_owner text; v_residents int;
BEGIN
  IF p_dorm_id IS NULL OR p_room_number IS NULL THEN
    RAISE EXCEPTION 'Invalid arguments' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_dorm_id::text || ':grant'));

  SELECT count(*) INTO v_residents FROM public.users
  WHERE role = 'talaba' AND dorm_id = p_dorm_id AND room_number = p_room_number;
  IF v_residents > 0 THEN
    RAISE EXCEPTION 'Room % still has % resident(s)', p_room_number, v_residents USING ERRCODE = 'P0003';
  END IF;

  DELETE FROM public.dorm_room_grant
  WHERE dorm_id = p_dorm_id AND room_number = p_room_number;

  -- floor_room_layout.faculty ni qavat egasiga qaytaramiz.
  SELECT floor_number INTO v_floor FROM public.floor_room_layout
  WHERE dorm_id = p_dorm_id AND room_number = p_room_number;
  SELECT faculty INTO v_owner FROM public.dorm_floor
  WHERE dorm_id = p_dorm_id AND floor_number = v_floor;
  IF v_owner IS NOT NULL THEN
    UPDATE public.floor_room_layout
    SET faculty = v_owner
    WHERE dorm_id = p_dorm_id AND room_number = p_room_number AND faculty <> v_owner;
  END IF;

  RETURN jsonb_build_object('room', p_room_number, 'cleared', true);
END;
$$;

-- ----------------------------------------------------------
-- 5. Grantlar — faqat service-role
-- ----------------------------------------------------------
REVOKE ALL ON FUNCTION public.assign_student_room_atomic(uuid, text, integer, uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_student_room_atomic(uuid, text, integer, uuid, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_student_room_atomic(uuid, text, integer, uuid, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.assign_permit_room_atomic(uuid, text, integer, uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, integer, uuid, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, integer, uuid, text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.dorm_grant_room(uuid, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dorm_grant_room(uuid, text, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dorm_grant_room(uuid, text, text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.dorm_ungrant_room(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dorm_ungrant_room(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dorm_ungrant_room(uuid, text) TO service_role;
