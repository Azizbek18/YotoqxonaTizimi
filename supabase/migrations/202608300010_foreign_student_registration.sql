-- Foreign/imtiyozli applicants do not have an Uzbek JSHSHIR. PostgreSQL's
-- `NULL = NULL` is not true, so both the insert guard and email activation
-- must use null-safe equality for the approved permit lookup.

CREATE OR REPLACE FUNCTION public.check_student_permit_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'talaba' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.permit_requests
      WHERE passport_series = NEW.passport_series
        AND (
          (NEW.jshshir IS NOT NULL AND jshshir = NEW.jshshir AND application_type = 'yollanma')
          OR
          (NEW.jshshir IS NULL AND jshshir IS NULL AND application_type = 'imtiyozli')
        )
        AND status = 'approved'
    ) THEN
      RAISE EXCEPTION 'Ushbu talabaning yotoqxona arizasi dekan tomonidan tasdiqlanmagan. Ro''yxatdan o''tish taqiqlanadi!';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_student_permit_approved()
  FROM PUBLIC, anon, authenticated;

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
