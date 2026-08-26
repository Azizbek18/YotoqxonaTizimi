-- Lets a dekan reserve a room for an *approved but not yet registered*
-- permit request. Previously a room could only be assigned to a real
-- `users` row, which meant nobody was assignable until the actual person
-- self-registered (features/permits/server/service.ts's `update` explicitly
-- nulls room_number on approval and leaves it that way). Now the dekan can
-- pick a room for the permit itself; when that person later registers
-- (app/api/student/register/route.ts already reads permit.room_number and
-- seeds the new user with it — that code has been dead until this migration
-- gives it a non-null value to work with), they land directly in the room.
--
-- Mirrors assign_student_room_atomic's shape (advisory lock, existence,
-- frozen, capacity, gender) but targets permit_requests and requires
-- status = 'approved' instead of a matching users row. Occupancy/gender
-- counts union both users and *other* approved permits on the room, same
-- as assign_student_room_atomic already does, so a permit and a real
-- resident can't jointly overbook or gender-conflict a room either.
CREATE OR REPLACE FUNCTION public.assign_permit_room_atomic(
  p_permit_id uuid,
  p_room_number text,
  p_max_capacity int DEFAULT 4
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gender text;
  v_occupied int;
  v_conflicting int;
  v_frozen boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_room_number));

  SELECT frozen INTO v_frozen FROM public.floor_room_layout WHERE room_number = p_room_number;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002';
  END IF;
  IF v_frozen THEN
    RAISE EXCEPTION 'Room is frozen' USING ERRCODE = 'P0004';
  END IF;

  SELECT gender INTO v_gender FROM public.permit_requests WHERE id = p_permit_id AND status = 'approved' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permit not approved' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users WHERE role = 'talaba' AND room_number = p_room_number
    UNION ALL
    SELECT id FROM public.permit_requests WHERE status = 'approved' AND room_number = p_room_number AND id <> p_permit_id
  ) occupants;

  IF v_occupied >= p_max_capacity THEN
    RAISE EXCEPTION 'Room is full' USING ERRCODE = 'P0001';
  END IF;

  IF v_gender IS NOT NULL THEN
    SELECT count(*) INTO v_conflicting FROM (
      SELECT gender FROM public.users WHERE role = 'talaba' AND room_number = p_room_number AND gender IS NOT NULL
      UNION ALL
      SELECT gender FROM public.permit_requests WHERE status = 'approved' AND room_number = p_room_number AND id <> p_permit_id AND gender IS NOT NULL
    ) g WHERE g.gender <> v_gender;

    IF v_conflicting > 0 THEN
      RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.permit_requests
  SET room_number = p_room_number, updated_at = now()
  WHERE id = p_permit_id AND status = 'approved';
END;
$$;

REVOKE ALL ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) TO service_role;
REVOKE EXECUTE ON FUNCTION public.assign_permit_room_atomic(uuid, text, int) FROM anon, authenticated;
