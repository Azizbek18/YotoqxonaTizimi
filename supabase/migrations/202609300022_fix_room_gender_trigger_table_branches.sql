-- `enforce_room_gender_integrity` is shared by `users` and
-- `permit_requests`.  A PL/pgSQL record only exposes the columns of the
-- table which fired the trigger, so a compound expression which mentions
-- `NEW.role` cannot safely run for a `permit_requests` row (that table has no
-- `role` column).  Branch on the trigger table before touching table-specific
-- fields.

CREATE OR REPLACE FUNCTION public.enforce_room_gender_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_layout text;
  v_room_gender text;
  v_section_gender text;
  v_conflicting integer;
  v_lock_key text;
BEGIN
  -- Only registered students and approved room reservations occupy a room.
  IF TG_TABLE_NAME = 'users' THEN
    IF NEW.role IS DISTINCT FROM 'talaba' OR NEW.room_number IS NULL THEN
      RETURN NEW;
    END IF;
  ELSIF TG_TABLE_NAME = 'permit_requests' THEN
    IF NEW.status IS DISTINCT FROM 'approved' OR NEW.room_number IS NULL THEN
      RETURN NEW;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported table for room gender trigger: %', TG_TABLE_NAME
      USING ERRCODE = 'P0001';
  END IF;

  -- Do not re-check unrelated profile edits on an already housed person.
  IF TG_OP = 'UPDATE'
    AND NEW.room_number IS NOT DISTINCT FROM OLD.room_number
    AND NEW.dorm_id IS NOT DISTINCT FROM OLD.dorm_id
    AND NEW.block IS NOT DISTINCT FROM OLD.block
    AND NEW.assigned_floor IS NOT DISTINCT FROM OLD.assigned_floor
    AND NEW.gender IS NOT DISTINCT FROM OLD.gender
    AND NEW.status IS NOT DISTINCT FROM OLD.status
  THEN
    RETURN NEW;
  END IF;

  IF NEW.gender IS NULL OR NEW.gender NOT IN ('male', 'female') THEN
    RAISE EXCEPTION 'Gender is required before room assignment' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.dorm_id IS NULL THEN
    RAISE EXCEPTION 'Dorm is required before room assignment' USING ERRCODE = 'P0002';
  END IF;

  SELECT layout_kind INTO v_layout FROM public.dorms WHERE id = NEW.dorm_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Dorm does not exist' USING ERRCODE = 'P0002';
  END IF;

  IF v_layout = 'blocked' THEN
    IF NEW.block IS NULL OR NEW.assigned_floor IS NULL THEN
      RAISE EXCEPTION 'Block and floor are required for this building' USING ERRCODE = 'P0002';
    END IF;
    v_lock_key := NEW.dorm_id::text || ':' || upper(btrim(NEW.block)) || ':'
      || NEW.assigned_floor::text || ':' || NEW.room_number;

    SELECT gender INTO v_room_gender
    FROM public.floor_room_layout
    WHERE dorm_id = NEW.dorm_id
      AND block = upper(btrim(NEW.block))
      AND floor_number = NEW.assigned_floor
      AND room_number = NEW.room_number;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002';
    END IF;

    SELECT gender INTO v_section_gender
    FROM public.dorm_section
    WHERE dorm_id = NEW.dorm_id
      AND block = upper(btrim(NEW.block))
      AND floor_number = NEW.assigned_floor;

    IF v_section_gender IS NOT NULL AND v_section_gender <> NEW.gender THEN
      RAISE EXCEPTION 'Section reserved for other gender' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    v_lock_key := NEW.dorm_id::text || ':' || NEW.room_number;

    SELECT gender INTO v_room_gender
    FROM public.floor_room_layout
    WHERE dorm_id = NEW.dorm_id AND room_number = NEW.room_number;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Room does not exist' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_lock_key));

  IF v_room_gender IS NOT NULL AND v_room_gender <> NEW.gender THEN
    RAISE EXCEPTION 'Room reserved for other gender' USING ERRCODE = 'P0001';
  END IF;

  SELECT count(*) INTO v_conflicting
  FROM (
    SELECT u.gender
    FROM public.users u
    WHERE u.role = 'talaba'
      AND u.dorm_id = NEW.dorm_id
      AND u.room_number = NEW.room_number
      AND (v_layout <> 'blocked' OR (
        u.block = upper(btrim(NEW.block)) AND u.assigned_floor = NEW.assigned_floor
      ))
      AND (TG_TABLE_NAME <> 'users' OR u.id <> NEW.id)
    UNION ALL
    SELECT p.gender
    FROM public.permit_requests p
    WHERE p.status = 'approved'
      AND p.dorm_id = NEW.dorm_id
      AND p.room_number = NEW.room_number
      AND (v_layout <> 'blocked' OR (
        p.block = upper(btrim(NEW.block)) AND p.assigned_floor = NEW.assigned_floor
      ))
      AND (TG_TABLE_NAME <> 'permit_requests' OR p.id <> NEW.id)
  ) occupants
  WHERE occupants.gender IS DISTINCT FROM NEW.gender;

  IF v_conflicting > 0 THEN
    RAISE EXCEPTION 'Gender mismatch in room' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_room_gender_integrity() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_room_gender_integrity() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_room_gender_integrity() TO service_role;
