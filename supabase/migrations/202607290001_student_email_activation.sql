-- Require proof of control of the approved email before a student profile
-- becomes active. The service-only function consumes the permit and activates
-- the matching pending profile in one transaction.

CREATE OR REPLACE FUNCTION public.activate_pending_student(
  p_user_id uuid,
  p_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    AND jshshir = v_jshshir
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

  UPDATE public.permit_requests
  SET status = 'registered',
      updated_at = now()
  WHERE id = v_permit_id
    AND status = 'approved';

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_pending_student(uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_pending_student(uuid, text)
  TO service_role;
