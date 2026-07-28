-- app/api/admin/users/route.ts promoted a floor captain as two separate
-- UPDATE statements (demote whoever currently holds the (assigned_floor,
-- gender) slot, then promote the target) using the TARGET's *current*,
-- pre-update gender even when this same request is also changing that
-- gender — so if floor+gender both change in one call, the wrong bucket's
-- captain gets demoted, and the new bucket ends up with two captains
-- (nothing demoted there) until the next unrelated promotion happens to
-- collide. The two statements also weren't transactional: a failure on the
-- second (promote) UPDATE left the first (demote) already committed, so a
-- floor could be left with no captain at all.
--
-- Move both writes — plus the assigned_floor/gender/is_floor_captain
-- columns being set on the target user themselves — into one function, so
-- they succeed or fail together and always act on the *final* intended
-- (assigned_floor, gender), never a stale value.
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

REVOKE ALL ON FUNCTION public.promote_floor_captain(uuid, int, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_floor_captain(uuid, int, text, boolean) TO service_role;
