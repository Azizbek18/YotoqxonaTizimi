-- ==========================================================
-- dorm_resolve_floor — qavat egaligi o'tganda xona qatorlarini ham sinxronlash
-- ==========================================================
-- 202609140000 dagi handshake faqat `dorm_floor.faculty` ni almashtirardi;
-- `floor_room_layout.faculty` eski egada qolib ketardi. `dorm_grant_room`
-- (202609300012) esa har doim `floor_room_layout.faculty` ni sinxron qiladi —
-- shu izchillik handshake da ham bo'lishi kerak.
--
-- Amaliy holat: 3-yotoqxona 2-qavati o'zbek-filologiyasidan AMIT ga to'liq
-- o'tkazilгач, 28 ta xona hali `ozbek-filologiyasi` deб turgan edi.
--
-- Bu migratsiya faqat `dorm_resolve_floor` ni CREATE OR REPLACE qiladi:
-- taklif QABUL qilinganда yangi egа `floor_room_layout.faculty` ga ham yoziladi,
-- lekin uchinchi fakultetга ALOHIDA grant qilingan xonalar (dorm_room_grant)
-- tegilmaydi — ularni `dorm_ungrant_room` boshqaradi. Bloksiz (simple) dorm
-- qatorlari (`block IS NULL`) bilan cheklangan; blokли binolar handshake
-- ishlatmaydi (`dorm_section`).

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

  -- Xona qatorlarining faculty tegи yangi qavat egasiga o'tadi; uchinchi
  -- fakultetга alohida grant qilingan xonalar (dorm_room_grant) tegilmaydi.
  UPDATE public.floor_room_layout frl
  SET faculty = v_row.pending_faculty
  WHERE frl.dorm_id = p_dorm_id
    AND frl.floor_number = p_floor
    AND frl.block IS NULL
    AND frl.faculty IS DISTINCT FROM v_row.pending_faculty
    AND NOT EXISTS (
      SELECT 1 FROM public.dorm_room_grant g
      WHERE g.dorm_id = p_dorm_id AND g.room_number = frl.room_number
    );

  RETURN jsonb_build_object('floor', p_floor, 'outcome', 'confirmed', 'faculty', v_row.pending_faculty);
END;
$$;

REVOKE ALL ON FUNCTION public.dorm_resolve_floor(uuid, int, uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dorm_resolve_floor(uuid, int, uuid, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dorm_resolve_floor(uuid, int, uuid, boolean) TO service_role;
