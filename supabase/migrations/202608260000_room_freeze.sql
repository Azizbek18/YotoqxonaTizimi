-- Renovation season: the dekan needs to take individual rooms out of
-- circulation (ta'mirlash — repairs) without deleting them from the floor
-- layout, and put them back once work is done. A frozen room keeps its
-- position/size/occupants exactly as-is; it's simply refused as a target
-- for new student placements.
ALTER TABLE floor_room_layout ADD COLUMN IF NOT EXISTS frozen boolean NOT NULL DEFAULT false;
ALTER TABLE floor_room_layout ADD COLUMN IF NOT EXISTS frozen_reason text;

-- replace_floor_room_layout does a DELETE + INSERT per floor (see
-- 202607280010) so the 3D builder can freely renumber/resize rooms. That
-- builder knows nothing about freeze state, so without carrying it forward
-- explicitly, a routine re-save of a floor would silently thaw every frozen
-- room on it. Snapshot frozen/frozen_reason for rooms that survive the
-- replace (same room_number present in the new p_rows) and restore it
-- after the insert; a room number that's new or was removed simply starts
-- unfrozen, same as before this migration.
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
  v_frozen_snapshot jsonb;
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

  SELECT jsonb_object_agg(old.room_number, jsonb_build_object('frozen', old.frozen, 'reason', old.frozen_reason))
  INTO v_frozen_snapshot
  FROM public.floor_room_layout old
  WHERE old.floor_number = p_floor_number AND old.frozen;

  DELETE FROM public.floor_room_layout WHERE floor_number = p_floor_number;

  INSERT INTO public.floor_room_layout (floor_number, room_number, side, position, size, frozen, frozen_reason)
  SELECT
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

-- Both room-placement RPCs already re-check room existence inside their
-- advisory lock (202607280005); add the same in-transaction frozen check
-- right after it, before the capacity/gender checks, so a room frozen for
-- ta'mirlash between the UI load and the submit can't be raced into.
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
