-- activate_pending_student had the same class of bug as
-- app/api/student/register/route.ts: its floor lookup matched a room_number
-- across ALL blocks/floors of a blocked-layout dorm (ambiguous — a single
-- dorm can have the same room number on every floor of every block), so it
-- fell through to a "rooms-per-floor" formula meant only for simple dorms,
-- which always resolves a small room number to floor 1. It also never
-- carried `block` onto the student row at all. Fix both: match block in the
-- lookup, and copy block across like every other room field.
CREATE OR REPLACE FUNCTION public.activate_pending_student(
  p_user_id uuid,
  p_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_passport text;
  v_jshshir text;
  v_permit_id uuid;
BEGIN
  IF p_user_id IS NULL
     OR p_email IS NULL
     OR length(trim(p_email)) < 3
     OR length(p_email) > 254 THEN
    RETURN false;
  END IF;

  SELECT passport_series, jshshir
  INTO v_passport, v_jshshir
  FROM public.users
  WHERE id = p_user_id
    AND role = 'talaba'
    AND status = 'pending'
    AND lower(trim(email)) = lower(trim(p_email))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT id
  INTO v_permit_id
  FROM public.permit_requests
  WHERE passport_series = v_passport
    AND (
      (v_jshshir IS NOT NULL AND jshshir = v_jshshir AND application_type = 'yollanma')
      OR
      (v_jshshir IS NULL AND jshshir IS NULL AND application_type = 'imtiyozli')
    )
    AND lower(trim(email)) = lower(trim(p_email))
    AND status = 'approved'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.users
  SET status = 'active',
      updated_at = now()
  WHERE id = p_user_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.users u
  SET room_number = pr.room_number,
      dorm_id = COALESCE(pr.dorm_id, u.dorm_id),
      block = pr.block,
      assigned_floor = COALESCE(
        (SELECT f.floor_number FROM public.floor_room_layout f
          WHERE f.room_number = pr.room_number
            AND f.dorm_id = COALESCE(pr.dorm_id, u.dorm_id)
            AND f.block IS NOT DISTINCT FROM pr.block),
        CASE
          WHEN pr.block IS NULL AND regexp_replace(pr.room_number, '\D', '', 'g') <> ''
          THEN GREATEST(1, ((regexp_replace(pr.room_number, '\D', '', 'g')::int - 1) / 30) + 1)
          ELSE NULL
        END
      ),
      updated_at = now()
  FROM public.permit_requests pr
  WHERE u.id = p_user_id
    AND pr.id = v_permit_id
    AND pr.room_number IS NOT NULL
    AND u.room_number IS NULL;

  UPDATE public.permit_requests
  SET status = 'registered',
      updated_at = now()
  WHERE id = v_permit_id
    AND status = 'approved';

  RETURN FOUND;
END;
$function$;

REVOKE ALL ON FUNCTION public.activate_pending_student(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_pending_student(uuid, text)
  TO service_role;
