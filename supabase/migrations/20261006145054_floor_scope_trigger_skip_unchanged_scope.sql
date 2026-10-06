-- The floor-scope trigger re-validated the creator on every UPDATE of the
-- listed columns. A floor notice or rota whose author has since been demoted
-- or moved could then never be touched again (42501), even by an update that
-- leaves its scope and author alone. Only validate when the scope or the
-- author actually changes; INSERTs are always validated.
CREATE OR REPLACE FUNCTION public.enforce_announcement_floor_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_creator public.users%ROWTYPE;
BEGIN
  IF NEW.audience <> 'floor' AND NEW.title <> 'HAFTALIK_NAVBATCHILIK_JADVALI' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
     AND NEW.dorm_id IS NOT DISTINCT FROM OLD.dorm_id
     AND NEW.target_block IS NOT DISTINCT FROM OLD.target_block
     AND NEW.target_floor IS NOT DISTINCT FROM OLD.target_floor
     AND NEW.target_gender IS NOT DISTINCT FROM OLD.target_gender
     AND NEW.audience IS NOT DISTINCT FROM OLD.audience
     AND NEW.title IS NOT DISTINCT FROM OLD.title
     AND NEW.faculty IS NOT DISTINCT FROM OLD.faculty THEN
    RETURN NEW;
  END IF;
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
