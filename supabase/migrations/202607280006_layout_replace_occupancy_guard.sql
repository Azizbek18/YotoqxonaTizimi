-- replace_floor_room_layout (202607260000) deletes every row of a floor's
-- layout and re-inserts the admin's submitted rows, with no check for
-- whether a room being dropped is still occupied. An admin editing the
-- floor's layout (e.g. resizing/renumbering a wing) could silently remove a
-- room number that a student is currently assigned to, or that has an
-- approved permit request pointing at it — leaving that student/permit
-- referencing a room_number that no longer exists in floor_room_layout at
-- all, with nothing to catch it (assign/approve only check existence going
-- forward, not the layout function itself, and it doesn't take the same
-- advisory lock those functions use).
--
-- Guard it the same way assign_student_room_atomic/approve_permit_room_atomic
-- check occupancy: block removal of any room number that still has an
-- active student (users.role = 'talaba') or an approved permit
-- (permit_requests.status = 'approved') pointing at it. Rooms that are kept
-- (same room_number present in the new rows) are unaffected even if their
-- side/position/size changes.
CREATE OR REPLACE FUNCTION public.replace_floor_room_layout(p_floor_number int, p_rows jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_removed_occupied text;
BEGIN
  SELECT string_agg(DISTINCT old.room_number, ', ') INTO v_removed_occupied
  FROM public.floor_room_layout old
  WHERE old.floor_number = p_floor_number
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_rows) AS r
      WHERE r->>'roomNumber' = old.room_number
    )
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
