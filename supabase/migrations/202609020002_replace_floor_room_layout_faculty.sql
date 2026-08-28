-- ==========================================================
-- Bosqich 1c — replace_floor_room_layout fakultet bo'yicha
-- ==========================================================
-- Qavat tarxi endi fakultet bo'yicha bo'linadi (202609020000): xona raqami
-- faqat bir fakultet binosi ichida yagona. Bu funksiya endi `p_faculty`
-- oladi va DELETE / INSERT / nomzod-ro'yxat / muzlatilgan-holat suratini
-- SHU fakultet qatorlariga cheklaydi.
--
-- ATAYLAB O'ZGARMAGAN (Bosqich 1d ga qoldirilgan, aralash talabalar
-- muammosi tufayli):
--   * Bandlik tekshiruvi hamon `room_number` bo'yicha (talabaning akademik
--     fakultetiga qaramay) — hozir bitta AMIT binosi bor, non-AMIT talabalar
--     ham shu binoda; ularni fakultet bo'yicha filtrlash band xonani
--     xatoliksiz o'chirishga yo'l qo'yardi.
--   * Advisory lock kalitlari yalang'och (hashtext(room_number),
--     pg_advisory_xact_lock(987654321, floor)) — assign_student_room_atomic
--     va boshqalar ham shu kalitni ishlatadi; ikkalasini birga (1d da)
--     o'zgartirmasak, 202607280008 tuzatgan poyga qaytadi.

DROP FUNCTION IF EXISTS public.replace_floor_room_layout(int, jsonb);

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
  PERFORM pg_advisory_xact_lock(987654321, p_floor_number);

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
      PERFORM pg_advisory_xact_lock(hashtext(v_room));
    END LOOP;
  END IF;

  -- Re-check occupancy only now that every affected room's lock is held.
  -- Matched by room_number alone on purpose (see header) — any resident or
  -- approved permit pointing at that number blocks its removal.
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
