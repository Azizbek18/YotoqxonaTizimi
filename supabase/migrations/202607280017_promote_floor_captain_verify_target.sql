-- promote_floor_captain (202607280012) demoted the existing captain for
-- (assigned_floor, gender) BEFORE checking that the target user actually
-- exists. If p_user_id doesn't correspond to a real row, the final UPDATE
-- affects 0 rows but still commits successfully — leaving that floor with
-- no captain at all and no error raised to the caller.
--
-- Verify the target exists (locking its row against concurrent changes)
-- before touching the previous captain.
CREATE OR REPLACE FUNCTION public.promote_floor_captain(
  p_user_id uuid,
  p_assigned_floor int,
  p_gender text,
  p_is_captain boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id FOR UPDATE) THEN
    RAISE EXCEPTION 'Target user does not exist' USING ERRCODE = 'P0001';
  END IF;

  IF p_is_captain AND p_assigned_floor IS NOT NULL AND p_gender IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('floor-captain:' || p_assigned_floor::text || ':' || p_gender));

    UPDATE public.users
    SET is_floor_captain = false
    WHERE is_floor_captain = true
      AND assigned_floor = p_assigned_floor
      AND gender = p_gender
      AND id <> p_user_id;
  END IF;

  UPDATE public.users
  SET assigned_floor = p_assigned_floor,
      gender = p_gender,
      is_floor_captain = p_is_captain
  WHERE id = p_user_id;
END;
$$;
