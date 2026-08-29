-- ==========================================================
-- P1a — dorm_floor: qavat kelishuvi (handshake)
-- ==========================================================
-- Bo'lingan yotoqxonada qavatlar ikki dekan o'rtasida kelishiladi:
-- bir dekan o'z qavatlarini TAKLIF qiladi, boshqa fakultetning dekani
-- TASDIQLAYDI. Bo'sh yotoqxonada (yagona fakultet) — avtomatik tasdiq.
--
-- Bu migratsiya dorm_floor ga taklif ustunlarini va 3 ta atomik RPC
-- qo'shadi. Hali hech qanday kod bularni chaqirmaydi (P1b/P1c).
-- Reja: https://claude.ai/code/artifact/abdee3c8-1065-4b46-ad6c-77de82844da3

-- ----------------------------------------------------------
-- 1. Taklif ustunlari
-- ----------------------------------------------------------
-- Birinchi da'vo hali tasdiqlanmagan bo'lsa faculty NULL bo'lishi mumkin
-- (dorm_floor_not_empty CHECK to'liq bo'sh qatorni to'sadi).
ALTER TABLE public.dorm_floor ALTER COLUMN faculty DROP NOT NULL;

ALTER TABLE public.dorm_floor ADD COLUMN IF NOT EXISTS pending_faculty text;
ALTER TABLE public.dorm_floor ADD COLUMN IF NOT EXISTS pending_by uuid REFERENCES public.staff(id) ON DELETE SET NULL;
ALTER TABLE public.dorm_floor ADD COLUMN IF NOT EXISTS pending_at timestamptz;

ALTER TABLE public.dorm_floor DROP CONSTRAINT IF EXISTS dorm_floor_not_empty;
ALTER TABLE public.dorm_floor ADD CONSTRAINT dorm_floor_not_empty
  CHECK (faculty IS NOT NULL OR pending_faculty IS NOT NULL);

ALTER TABLE public.dorm_floor DROP CONSTRAINT IF EXISTS dorm_floor_distinct_claims;
ALTER TABLE public.dorm_floor ADD CONSTRAINT dorm_floor_distinct_claims
  CHECK (faculty IS DISTINCT FROM pending_faculty);

ALTER TABLE public.dorm_floor DROP CONSTRAINT IF EXISTS dorm_floor_pending_pair;
ALTER TABLE public.dorm_floor ADD CONSTRAINT dorm_floor_pending_pair
  CHECK ((pending_faculty IS NULL) = (pending_at IS NULL));

CREATE INDEX IF NOT EXISTS dorm_floor_pending_idx
  ON public.dorm_floor (dorm_id, pending_faculty)
  WHERE pending_faculty IS NOT NULL;

-- ----------------------------------------------------------
-- 2. dorm_claim_floors — qavatlarni taklif qilish / avtomatik tasdiq
-- ----------------------------------------------------------
-- p_floors — dekan o'ziga tegishli deb belgilagan qavatlar. Yotoqxonada
-- boshqa tasdiqlangan fakultet bo'lmasa hammasi darhol tasdiqlanadi;
-- bo'lsa — 'proposed' bo'ladi va narigi dekan tasdig'ini kutadi.
-- Boshqa fakultet allaqachon TASDIQLAGAN qavatga taklif = egallash so'rovi.
-- Natija: {confirmed:[...], proposed:[...]}.
CREATE OR REPLACE FUNCTION public.dorm_claim_floors(
  p_dorm_id uuid,
  p_faculty text,
  p_floors int[],
  p_staff_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_floor_count int;
  v_has_other_confirmed boolean;
  v_floor int;
  v_existing public.dorm_floor%ROWTYPE;
  v_confirmed int[] := ARRAY[]::int[];
  v_proposed  int[] := ARRAY[]::int[];
BEGIN
  IF p_dorm_id IS NULL OR p_faculty IS NULL OR btrim(p_faculty) = '' OR p_staff_id IS NULL THEN
    RAISE EXCEPTION 'Invalid arguments' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('dorm_floor:' || p_dorm_id::text));

  SELECT floor_count INTO v_floor_count FROM public.dorms WHERE id = p_dorm_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dorm not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.dorm_floor
    WHERE dorm_id = p_dorm_id AND faculty IS NOT NULL AND faculty <> p_faculty
  ) INTO v_has_other_confirmed;

  FOREACH v_floor IN ARRAY COALESCE(p_floors, ARRAY[]::int[]) LOOP
    IF v_floor < 1 OR v_floor > v_floor_count THEN
      RAISE EXCEPTION 'Floor % is outside 1..%', v_floor, v_floor_count USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_existing FROM public.dorm_floor
    WHERE dorm_id = p_dorm_id AND floor_number = v_floor;

    IF FOUND AND v_existing.faculty = p_faculty AND v_existing.pending_faculty IS NULL THEN
      v_confirmed := v_confirmed || v_floor;      -- allaqachon meniki
      CONTINUE;
    END IF;

    IF FOUND AND v_existing.pending_faculty IS NOT NULL AND v_existing.pending_faculty <> p_faculty THEN
      RAISE EXCEPTION 'Floor % already has a pending claim by %', v_floor, v_existing.pending_faculty
        USING ERRCODE = 'P0006';
    END IF;

    IF NOT v_has_other_confirmed THEN
      INSERT INTO public.dorm_floor (dorm_id, floor_number, faculty, confirmed_by, confirmed_at)
      VALUES (p_dorm_id, v_floor, p_faculty, p_staff_id, now())
      ON CONFLICT (dorm_id, floor_number) DO UPDATE SET
        faculty = p_faculty, confirmed_by = p_staff_id, confirmed_at = now(),
        pending_faculty = NULL, pending_by = NULL, pending_at = NULL, updated_at = now();
      v_confirmed := v_confirmed || v_floor;
    ELSE
      INSERT INTO public.dorm_floor (dorm_id, floor_number, pending_faculty, pending_by, pending_at)
      VALUES (p_dorm_id, v_floor, p_faculty, p_staff_id, now())
      ON CONFLICT (dorm_id, floor_number) DO UPDATE SET
        pending_faculty = p_faculty, pending_by = p_staff_id, pending_at = now(), updated_at = now();
      v_proposed := v_proposed || v_floor;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('confirmed', to_jsonb(v_confirmed), 'proposed', to_jsonb(v_proposed));
END;
$$;

-- ----------------------------------------------------------
-- 3. dorm_resolve_floor — narigi dekan taklifni tasdiqlaydi / rad etadi
-- ----------------------------------------------------------
-- Tasdiqda: egallash bo'lsa (oldingi egasi bor) — o'sha qavatда oldingi
-- fakultetning talabasi qolmagan bo'lishi shart.
CREATE OR REPLACE FUNCTION public.dorm_resolve_floor(
  p_dorm_id uuid,
  p_floor int,
  p_staff_id uuid,
  p_accept boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.dorm_floor%ROWTYPE;
  v_residents int;
BEGIN
  IF p_dorm_id IS NULL OR p_floor IS NULL OR p_staff_id IS NULL OR p_accept IS NULL THEN
    RAISE EXCEPTION 'Invalid arguments' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('dorm_floor:' || p_dorm_id::text));

  SELECT * INTO v_row FROM public.dorm_floor
  WHERE dorm_id = p_dorm_id AND floor_number = p_floor;
  IF NOT FOUND OR v_row.pending_faculty IS NULL THEN
    RAISE EXCEPTION 'No pending claim on floor %', p_floor USING ERRCODE = 'P0002';
  END IF;

  IF NOT p_accept THEN
    IF v_row.faculty IS NULL THEN
      DELETE FROM public.dorm_floor WHERE dorm_id = p_dorm_id AND floor_number = p_floor;
    ELSE
      UPDATE public.dorm_floor SET
        pending_faculty = NULL, pending_by = NULL, pending_at = NULL, updated_at = now()
      WHERE dorm_id = p_dorm_id AND floor_number = p_floor;
    END IF;
    RETURN jsonb_build_object('floor', p_floor, 'outcome', 'rejected');
  END IF;

  IF v_row.faculty IS NOT NULL THEN
    SELECT count(*) INTO v_residents
    FROM public.users u
    WHERE u.role = 'talaba'
      AND u.dorm_id = p_dorm_id
      AND coalesce(nullif(btrim(u.faculty), ''), 'amit') = v_row.faculty
      AND (
        u.assigned_floor = p_floor
        OR u.room_number IN (
          SELECT room_number FROM public.floor_room_layout
          WHERE dorm_id = p_dorm_id AND floor_number = p_floor
        )
      );
    IF v_residents > 0 THEN
      RAISE EXCEPTION 'Floor % still has % resident(s) from %', p_floor, v_residents, v_row.faculty
        USING ERRCODE = 'P0003';
    END IF;
  END IF;

  UPDATE public.dorm_floor SET
    faculty = v_row.pending_faculty,
    confirmed_by = p_staff_id, confirmed_at = now(),
    pending_faculty = NULL, pending_by = NULL, pending_at = NULL, updated_at = now()
  WHERE dorm_id = p_dorm_id AND floor_number = p_floor;

  RETURN jsonb_build_object('floor', p_floor, 'outcome', 'confirmed', 'faculty', v_row.pending_faculty);
END;
$$;

-- ----------------------------------------------------------
-- 4. dorm_withdraw_floors — taklif qiluvchi o'z taklifini bekor qiladi
-- ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dorm_withdraw_floors(
  p_dorm_id uuid,
  p_faculty text,
  p_floors int[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
  v_cleared int;
BEGIN
  IF p_dorm_id IS NULL OR p_faculty IS NULL THEN
    RAISE EXCEPTION 'Invalid arguments' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('dorm_floor:' || p_dorm_id::text));

  -- Oldingi egasi bo'lmagan (sof taklif) qatorlar o'chadi.
  DELETE FROM public.dorm_floor
  WHERE dorm_id = p_dorm_id
    AND pending_faculty = p_faculty
    AND faculty IS NULL
    AND (p_floors IS NULL OR floor_number = ANY(p_floors));
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  -- Oldingi egasi bor qatorlarda faqat taklif tozalanadi.
  UPDATE public.dorm_floor SET
    pending_faculty = NULL, pending_by = NULL, pending_at = NULL, updated_at = now()
  WHERE dorm_id = p_dorm_id
    AND pending_faculty = p_faculty
    AND faculty IS NOT NULL
    AND (p_floors IS NULL OR floor_number = ANY(p_floors));
  GET DIAGNOSTICS v_cleared = ROW_COUNT;

  RETURN jsonb_build_object('withdrawn', v_deleted + v_cleared);
END;
$$;

-- ----------------------------------------------------------
-- 5. Grantlar — faqat service-role
-- ----------------------------------------------------------
REVOKE ALL ON FUNCTION public.dorm_claim_floors(uuid, text, int[], uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dorm_claim_floors(uuid, text, int[], uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dorm_claim_floors(uuid, text, int[], uuid) TO service_role;

REVOKE ALL ON FUNCTION public.dorm_resolve_floor(uuid, int, uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dorm_resolve_floor(uuid, int, uuid, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dorm_resolve_floor(uuid, int, uuid, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.dorm_withdraw_floors(uuid, text, int[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dorm_withdraw_floors(uuid, text, int[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dorm_withdraw_floors(uuid, text, int[]) TO service_role;
