-- 202607280006 added an occupancy check to replace_floor_room_layout but
-- didn't take the same per-room advisory lock that
-- assign_student_room_atomic/approve_permit_room_atomic use — so the check
-- and the DELETE below it aren't atomic against a concurrent assignment:
--
--   1. replace_floor_room_layout sees room X as unoccupied.
--   2. A concurrent assign/approve call places a student in room X.
--   3. replace_floor_room_layout deletes room X from the layout anyway.
--   4. The student is now assigned to a room_number that doesn't exist.
--
-- Fix by taking pg_advisory_xact_lock(hashtext(room_number)) — the exact
-- same lock key assign/approve take — for every room being removed, sorted
-- to a deterministic order, before re-checking occupancy. Once a lock is
-- acquired, any assignment that was in flight for that room has already
-- committed or rolled back, so the occupancy check that follows sees the
-- true final state. Locking one room at a time in a fixed global order
-- (ascending room_number) can't deadlock against assign/approve, since
-- those only ever hold a single room's lock at once.
CREATE OR REPLACE FUNCTION public.replace_floor_room_layout(p_floor_number int, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_removed_rooms text[];
  v_room text;
  v_removed_occupied text;
BEGIN
  SELECT array_agg(DISTINCT old.room_number ORDER BY old.room_number) INTO v_removed_rooms
  FROM public.floor_room_layout old
  WHERE old.floor_number = p_floor_number
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_rows) AS r
      WHERE r->>'roomNumber' = old.room_number
    );

  IF v_removed_rooms IS NOT NULL THEN
    FOREACH v_room IN ARRAY v_removed_rooms LOOP
      PERFORM pg_advisory_xact_lock(hashtext(v_room));
    END LOOP;
  END IF;

  -- Re-check occupancy only now that every affected room's lock is held —
  -- this, not the earlier candidate list, is what guards the DELETE below.
  SELECT string_agg(DISTINCT old.room_number, ', ') INTO v_removed_occupied
  FROM public.floor_room_layout old
  WHERE old.floor_number = p_floor_number
    AND old.room_number = ANY(v_removed_rooms)
    AND (
      EXISTS (SELECT 1 FROM public.users u WHERE u.role = 'talaba' AND u.room_number = old.room_number)
      OR EXISTS (SELECT 1 FROM public.permit_requests p WHERE p.status = 'approved' AND p.room_number = old.room_number)
    );

  IF v_removed_occupied IS NOT NULL THEN
    RAISE EXCEPTION 'Occupied rooms cannot be removed from layout: %', v_removed_occupied USING ERRCODE = 'P0003';
  END IF;

  DELETE FROM public.floor_room_layout WHERE floor_number = p_floor_number;

  INSERT INTO public.floor_room_layout (floor_number, room_number, side, position, size)
  SELECT p_floor_number, r->>'roomNumber', r->>'side', (r->>'position')::int, r->>'size'
  FROM jsonb_array_elements(p_rows) AS r;
END;
$$;
