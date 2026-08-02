-- The zamdekan "Talabalar" bo'limi can now issue a warning to a student
-- (typically over an unpaid dormitory contract). A warning is two writes:
-- the arizalar row the student actually reads, and users.warning_count —
-- the number the expulsion threshold (app_settings.warning_threshold) is
-- measured against, and the number the admin panel shows. Doing those as
-- two round trips from the API route would allow a warning row with no
-- count bump (second statement fails), and would let two warnings issued
-- at the same moment both read the same pre-update count and write the
-- same new value, silently losing one.
--
-- The count is re-derived, not blindly incremented, for two reasons:
--   * The live database carries an `update_warning_count()` function that
--     exists in no migration in this repo (see 202607280020) — if that is
--     wired to a trigger on arizalar, a blind `+ 1` here would double-count.
--   * GREATEST(current, derived) keeps a value an admin set by hand in
--     app/admin/foydalanuvchilar (that page can edit warning_count
--     directly) from being silently lowered by this function.
-- The derivation matches exactly the filter the student-facing warnings
-- list uses (features/applications/server/repository.ts, kind='warnings'),
-- so users.warning_count and the list the student sees never disagree.
CREATE OR REPLACE FUNCTION public.create_student_warning_atomic(
  p_student_id uuid,
  p_title text,
  p_text text,
  p_level text
)
RETURNS TABLE (warning_id uuid, new_warning_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student public.users%ROWTYPE;
  v_id uuid;
  v_count integer;
BEGIN
  IF p_level NOT IN ('info', 'warning') THEN
    RAISE EXCEPTION 'invalid warning level: %', p_level USING ERRCODE = 'P0001';
  END IF;

  -- FOR UPDATE serializes concurrent warnings against the same student, so
  -- the re-derivation below always sees this transaction's own inserted row
  -- and never races another one.
  SELECT * INTO v_student
  FROM public.users u
  WHERE u.id = p_student_id AND u.role = 'talaba'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found: %', p_student_id USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.arizalar (
    student_id, student_name, faculty, direction, course,
    title, type, reason, text, level, status, date
  )
  VALUES (
    p_student_id, v_student.full_name, v_student.faculty, v_student.direction,
    COALESCE(v_student.course, 1),
    p_title, 'ogohlantirish', p_text, p_text, p_level, 'submitted',
    timezone('utc'::text, now())
  )
  RETURNING id INTO v_id;

  -- Only a real warning moves the disciplinary counter; an 'info' eslatma
  -- reaches the student without pushing them toward chetlatilish.
  IF p_level = 'warning' THEN
    UPDATE public.users u
    SET warning_count = GREATEST(
      COALESCE(u.warning_count, 0),
      (
        SELECT count(*)
        FROM public.arizalar a
        WHERE a.student_id = p_student_id
          AND a.status <> 'draft'
          AND a.type <> 'chat'
          AND a.level IN ('warning', 'critical')
      )
    )
    WHERE u.id = p_student_id
    RETURNING u.warning_count INTO v_count;
  ELSE
    v_count := COALESCE(v_student.warning_count, 0);
  END IF;

  RETURN QUERY SELECT v_id, v_count;
END;
$$;

-- Same lockdown as every other SECURITY DEFINER function here: only the
-- app's own service-role client may call it. The function performs no
-- caller-identity check of its own — the faculty scoping lives in
-- features/faculty-students/server/service.ts — so a direct anon/
-- authenticated call would be an unauthenticated "warn any student"
-- endpoint. 202607280021/202607280022 already changed the project default
-- so new functions don't get those grants automatically; these are
-- explicit anyway, in case that default ever drifts back.
REVOKE ALL ON FUNCTION public.create_student_warning_atomic(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_student_warning_atomic(uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_student_warning_atomic(uuid, text, text, text) TO service_role;
