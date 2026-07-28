-- The app layer previously checked room existence with a separate SELECT
-- before calling these RPCs, then relied on the RPC's own advisory lock for
-- the capacity/gender check. That's a TOCTOU gap: a room deleted from
-- floor_room_layout between the SELECT and the RPC call would still get
-- written to a student/permit, since the RPC itself never verified it.
-- Move the existence check inside each function, after the advisory lock,
-- so it's covered by the same atomicity guarantee as the capacity check.
CREATE OR REPLACE FUNCTION public.assign_student_room_atomic(
  p_student_id uuid,
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
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_room_number));

  IF NOT EXISTS (SELECT 1 FROM public.floor_room_layout WHERE room_number = p_room_number) THEN
    RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002';
  END IF;

  SELECT gender INTO v_gender FROM public.users WHERE id = p_student_id AND role = 'talaba';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student not found' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users WHERE role = 'talaba' AND room_number = p_room_number AND id <> p_student_id
    UNION ALL
    SELECT id FROM public.permit_requests WHERE status = 'approved' AND room_number = p_room_number
  ) occupants;

  IF v_occupied >= p_max_capacity THEN
    RAISE EXCEPTION 'Room is full' USING ERRCODE = 'P0001';
  END IF;

  IF v_gender IS NOT NULL THEN
    SELECT count(*) INTO v_conflicting FROM (
      SELECT gender FROM public.users WHERE role = 'talaba' AND room_number = p_room_number AND id <> p_student_id AND gender IS NOT NULL
      UNION ALL
      SELECT gender FROM public.permit_requests WHERE status = 'approved' AND room_number = p_room_number AND gender IS NOT NULL
    ) g WHERE g.gender <> v_gender;

    IF v_conflicting > 0 THEN
      RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.users
  SET room_number = p_room_number,
      assigned_floor = COALESCE(
        (SELECT floor_number FROM public.floor_room_layout WHERE room_number = p_room_number),
        CASE
          WHEN regexp_replace(p_room_number, '\D', '', 'g') <> ''
          THEN GREATEST(1, ((regexp_replace(p_room_number, '\D', '', 'g')::int - 1) / 30) + 1)
          ELSE NULL
        END
      )
  WHERE id = p_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_permit_room_atomic(
  p_permit_id uuid,
  p_room_number text,
  p_max_capacity int DEFAULT 4
)
RETURNS SETOF public.permit_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gender text;
  v_occupied int;
  v_conflicting int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_room_number));

  IF NOT EXISTS (SELECT 1 FROM public.floor_room_layout WHERE room_number = p_room_number) THEN
    RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002';
  END IF;

  SELECT gender INTO v_gender FROM public.permit_requests WHERE id = p_permit_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Permit not pending' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_occupied FROM (
    SELECT id FROM public.users WHERE role = 'talaba' AND room_number = p_room_number
    UNION ALL
    SELECT id FROM public.permit_requests WHERE status = 'approved' AND room_number = p_room_number
  ) occupants;

  IF v_occupied >= p_max_capacity THEN
    RAISE EXCEPTION 'Room is full' USING ERRCODE = 'P0001';
  END IF;

  IF v_gender IS NOT NULL THEN
    SELECT count(*) INTO v_conflicting FROM (
      SELECT gender FROM public.users WHERE role = 'talaba' AND room_number = p_room_number AND gender IS NOT NULL
      UNION ALL
      SELECT gender FROM public.permit_requests WHERE status = 'approved' AND room_number = p_room_number AND gender IS NOT NULL
    ) g WHERE g.gender <> v_gender;

    IF v_conflicting > 0 THEN
      RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN QUERY
  UPDATE public.permit_requests
  SET status = 'approved', room_number = p_room_number, reject_reason = NULL
  WHERE id = p_permit_id AND status = 'pending'
  RETURNING *;
END;
$$;
