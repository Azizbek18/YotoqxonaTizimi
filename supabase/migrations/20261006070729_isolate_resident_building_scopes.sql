-- A faculty may live in several buildings and blocks. Physical scopes must
-- never be inferred from faculty alone. Existing role/function signatures stay compatible.
ALTER TABLE public.elonlar ADD COLUMN IF NOT EXISTS dorm_id uuid REFERENCES public.dorms(id);
ALTER TABLE public.elonlar ADD COLUMN IF NOT EXISTS target_block text;

UPDATE public.elonlar e SET dorm_id = u.dorm_id, target_block = u.block
FROM public.users u WHERE e.created_by = u.id
  AND (e.audience = 'floor' OR e.title = 'HAFTALIK_NAVBATCHILIK_JADVALI')
  AND e.dorm_id IS NULL AND u.dorm_id IS NOT NULL
  AND e.target_floor = u.assigned_floor AND e.target_gender = u.gender;

DROP INDEX IF EXISTS public.users_floor_captain_unique_idx;
CREATE UNIQUE INDEX users_floor_captain_unique_idx ON public.users
  (dorm_id, COALESCE(block, ''), assigned_floor, gender, COALESCE(NULLIF(faculty, ''), 'amit'))
  WHERE is_floor_captain = true;

CREATE OR REPLACE FUNCTION public.promote_floor_captain(
  p_user_id uuid, p_assigned_floor int, p_gender text, p_is_captain boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_target public.users%ROWTYPE; v_current public.users%ROWTYPE;
BEGIN
  SELECT * INTO v_target FROM public.users WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target user does not exist' USING ERRCODE = 'P0001'; END IF;
  IF NOT p_is_captain THEN
    UPDATE public.users SET is_floor_captain = false WHERE id = p_user_id;
    RETURN;
  END IF;
  IF v_target.role IS DISTINCT FROM 'talaba' OR v_target.status IS DISTINCT FROM 'active'
     OR v_target.is_off_campus OR v_target.dorm_id IS NULL OR v_target.room_number IS NULL
     OR v_target.assigned_floor IS NULL OR v_target.gender NOT IN ('male', 'female')
     OR v_target.gender IS NULL OR v_target.faculty IS NULL
     OR v_target.assigned_floor IS DISTINCT FROM p_assigned_floor OR v_target.gender IS DISTINCT FROM p_gender THEN
    RAISE EXCEPTION 'Active housed student with matching floor and gender required' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('floor-captain:' || v_target.dorm_id::text
    || ':' || COALESCE(v_target.block, '') || ':' || p_assigned_floor::text || ':' || p_gender || ':' || v_target.faculty, 0));
  SELECT * INTO v_current FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF v_current.dorm_id IS DISTINCT FROM v_target.dorm_id OR v_current.block IS DISTINCT FROM v_target.block
    OR v_current.assigned_floor IS DISTINCT FROM v_target.assigned_floor
    OR v_current.gender IS DISTINCT FROM v_target.gender OR v_current.faculty IS DISTINCT FROM v_target.faculty
    OR v_current.status IS DISTINCT FROM 'active' OR v_current.role IS DISTINCT FROM 'talaba'
    OR v_current.is_off_campus OR v_current.room_number IS NULL THEN
    RAISE EXCEPTION 'Student scope changed; retry' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.users SET is_floor_captain = false
    WHERE is_floor_captain = true AND dorm_id = v_target.dorm_id
      AND block IS NOT DISTINCT FROM v_target.block AND assigned_floor = p_assigned_floor
      AND gender = p_gender AND faculty = v_target.faculty AND id <> p_user_id;
  UPDATE public.users SET is_floor_captain = true WHERE id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_floor_captain(uuid, int, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_floor_captain(uuid, int, text, boolean) TO service_role;

DROP INDEX IF EXISTS public.elonlar_duty_schedule_scope_uidx;
CREATE UNIQUE INDEX elonlar_duty_schedule_scope_uidx ON public.elonlar
  (dorm_id, COALESCE(target_block, ''), faculty, target_floor, target_gender)
  WHERE title = 'HAFTALIK_NAVBATCHILIK_JADVALI' AND dorm_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.upsert_floor_duty_schedule(
  p_creator_id uuid, p_floor integer, p_gender text, p_text text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid; v_captain public.users%ROWTYPE;
BEGIN
  IF p_floor IS NULL OR p_floor < 1 OR p_gender IS NULL OR p_gender NOT IN ('male', 'female')
    OR p_text IS NULL OR length(p_text) > 100000 THEN
    RAISE EXCEPTION 'Invalid duty schedule input' USING ERRCODE = '22023';
  END IF;
  PERFORM p_text::jsonb;
  SELECT * INTO v_captain FROM public.users WHERE id = p_creator_id
    AND role = 'talaba' AND status = 'active' AND is_floor_captain = true
    AND assigned_floor = p_floor AND gender = p_gender
    AND dorm_id IS NOT NULL AND room_number IS NOT NULL AND NOT is_off_campus FOR SHARE;
  IF NOT FOUND OR v_captain.faculty IS NULL THEN
    RAISE EXCEPTION 'Active housed floor captain required' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('duty-schedule:' || v_captain.dorm_id::text
    || ':' || COALESCE(v_captain.block, '') || ':' || v_captain.faculty || ':' || p_floor::text || ':' || p_gender, 0));
  SELECT id INTO v_id FROM public.elonlar
    WHERE title = 'HAFTALIK_NAVBATCHILIK_JADVALI'
      AND dorm_id = v_captain.dorm_id AND target_block IS NOT DISTINCT FROM v_captain.block
      AND faculty = v_captain.faculty AND target_floor = p_floor AND target_gender = p_gender FOR UPDATE;
  IF FOUND THEN
    UPDATE public.elonlar SET text = p_text, created_by = p_creator_id,
      is_published = true, updated_at = now() WHERE id = v_id;
  ELSE
    INSERT INTO public.elonlar (title, text, type, audience, faculty, dorm_id, target_block,
      is_published, created_by, target_floor, target_gender)
    VALUES ('HAFTALIK_NAVBATCHILIK_JADVALI', p_text, 'Yangilik', 'internal', v_captain.faculty,
      v_captain.dorm_id, v_captain.block, true, p_creator_id, p_floor, p_gender) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.upsert_floor_duty_schedule(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_floor_duty_schedule(uuid, integer, text, text) TO service_role;

ALTER TABLE public.elonlar ADD CONSTRAINT elonlar_physical_floor_scope_check
CHECK ((audience <> 'floor' AND title <> 'HAFTALIK_NAVBATCHILIK_JADVALI')
  OR (dorm_id IS NOT NULL AND target_floor IS NOT NULL AND target_gender IN ('male', 'female'))) NOT VALID;

-- Stamp the actual creator address for older API versions too. Reject an
-- explicit foreign address instead of trusting client-supplied scope.
CREATE OR REPLACE FUNCTION public.enforce_announcement_floor_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_creator public.users%ROWTYPE;
BEGIN
  IF NEW.audience <> 'floor' AND NEW.title <> 'HAFTALIK_NAVBATCHILIK_JADVALI' THEN RETURN NEW; END IF;
  SELECT * INTO v_creator FROM public.users WHERE id = NEW.created_by
    AND role = 'talaba' AND status = 'active' AND is_floor_captain = true
    AND dorm_id IS NOT NULL AND room_number IS NOT NULL AND NOT is_off_campus;
  IF NOT FOUND OR NEW.target_floor IS DISTINCT FROM v_creator.assigned_floor
    OR NEW.target_gender IS DISTINCT FROM v_creator.gender OR NEW.faculty IS DISTINCT FROM v_creator.faculty THEN
    RAISE EXCEPTION 'Announcement must belong to the creator floor' USING ERRCODE = '42501';
  END IF;
  IF NEW.dorm_id IS NOT NULL AND (NEW.dorm_id IS DISTINCT FROM v_creator.dorm_id
    OR NEW.target_block IS DISTINCT FROM v_creator.block) THEN
    RAISE EXCEPTION 'Announcement must belong to the creator building and block' USING ERRCODE = '42501';
  END IF;
  NEW.dorm_id := v_creator.dorm_id;
  NEW.target_block := v_creator.block;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_announcement_floor_scope() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_announcement_floor_scope() TO service_role;
CREATE TRIGGER enforce_announcement_floor_scope BEFORE INSERT OR UPDATE OF
  created_by, dorm_id, target_block, target_floor, target_gender, audience, title, faculty
  ON public.elonlar FOR EACH ROW EXECUTE FUNCTION public.enforce_announcement_floor_scope();
