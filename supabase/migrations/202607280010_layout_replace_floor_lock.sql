-- 202607280008 only locks the individual rooms being removed, not the
-- floor as a whole. Two concurrent saves of the SAME floor (e.g. two admin
-- tabs, or a double-click) each compute their own "rooms being removed"
-- set from the layout as it stood before either transaction started, lock
-- only their own set, and then both proceed to DELETE + INSERT against
-- floor_room_layout — nothing serializes the two calls against each other,
-- so they can interleave into a mixed layout, or collide on a duplicate
-- room_number and surface as a raw 23505.
--
-- Fix by taking a floor-scoped advisory lock FIRST, before computing which
-- rooms are being removed, so the entire replace (compute → lock rooms →
-- check occupancy → delete → insert) is serialized per floor. A second
-- concurrent call for the same floor blocks until the first fully commits,
-- then correctly recomputes its removed-room set against the now-current
-- layout. Uses the two-argument pg_advisory_xact_lock(int, int) form with a
-- fixed, distinctive first key so this floor-level lock class can never
-- collide with the per-room locks (which use the single-bigint form keyed
-- by hashtext(room_number)) in any way that would matter — a same-value
-- collision would only cause extra waiting, never incorrect behavior.
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
  PERFORM pg_advisory_xact_lock(987654321, p_floor_number);

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
