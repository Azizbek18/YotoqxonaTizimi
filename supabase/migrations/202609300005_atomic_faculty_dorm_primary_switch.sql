-- Atomically link a faculty to a dorm and make it primary.
--
-- The application used to upsert `is_primary = true` before calling this
-- function. When the faculty already had a primary dorm, the partial unique
-- index rejected that upsert before the old row could be demoted. Keeping the
-- link insert and flag switch inside this function removes that invalid
-- intermediate state. The advisory lock serializes concurrent switches for
-- the same faculty.

CREATE OR REPLACE FUNCTION public.set_primary_dorm(p_faculty text, p_dorm_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_faculty text := lower(btrim(p_faculty));
BEGIN
  IF v_faculty IS NULL OR v_faculty = '' OR p_dorm_id IS NULL THEN
    RAISE EXCEPTION 'Fakultet va yotoqxona ko‘rsatilishi shart'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.dorms WHERE id = p_dorm_id) THEN
    RAISE EXCEPTION 'Yotoqxona % topilmadi', p_dorm_id
      USING ERRCODE = 'P0002';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('faculty-dorm-primary:' || v_faculty, 0)
  );

  INSERT INTO public.faculty_dorm (faculty, dorm_id, is_primary)
  VALUES (v_faculty, p_dorm_id, false)
  ON CONFLICT (faculty, dorm_id) DO NOTHING;

  UPDATE public.faculty_dorm
  SET is_primary = false
  WHERE faculty = v_faculty
    AND dorm_id <> p_dorm_id
    AND is_primary;

  UPDATE public.faculty_dorm
  SET is_primary = true
  WHERE faculty = v_faculty
    AND dorm_id = p_dorm_id
    AND NOT is_primary;
END;
$$;

REVOKE ALL ON FUNCTION public.set_primary_dorm(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_primary_dorm(text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_primary_dorm(text, uuid) TO service_role;
