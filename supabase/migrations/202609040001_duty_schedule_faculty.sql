-- ==========================================================
-- Bosqich 1f (2/2) — navbatchilik jadvali + qavat e'lonlari fakultet bo'yicha
-- ==========================================================
-- Haftalik navbatchilik jadvali (elonlar.title = 'HAFTALIK_NAVBATCHILIK_JADVALI')
-- va qavat e'lonlari (audience = 'floor') jismoniy qavatga tegishli.
-- Har fakultet o'z binosiga ega bo'lgach, "3-qavat, o'g'il" jadvali har
-- binoda ALOHIDA bo'ladi.
--
-- Xavfsizlik: hozir bu qatorlar faqat (target_floor, target_gender) bo'yicha
-- ajratilgan — ya'ni bir bino sardorining jadvali/e'loni BOSHQA fakultet
-- binosining o'sha raqamli qavatidagi talabalarga ham yetadi
-- (features/announcements/server/service.ts). Bu fakultetlararo ma'lumot
-- sizishi. Quyida:
--   * mavjud jadval/e'lon qatorlariga faculty='amit' beriladi (bitta bino)
--   * unikallik indeksi (faculty, target_floor, target_gender) bo'ladi
--   * CHECK jadval qatoridan faculty'ni ham talab qiladi
--   * upsert_floor_duty_schedule fakultetni SARDORdan oladi (p_faculty
--     e'tiborsiz — soxtalashtirib bo'lmasin)

CREATE OR REPLACE FUNCTION pg_temp.faculty_ok(p_value text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$ SELECT lower(coalesce(p_value, '')) IN (
  'matematika','amit','fizika','kimyo','biologiya','geologiya','geografiya',
  'iqtisodiyot','tarix','ijtimoiy-fanlar','xorijiy-filologiya','ozbek-filologiyasi','sport'
) $$;

-- 1. Backfill — bitta AMIT binosi.
UPDATE public.elonlar
SET faculty = 'amit'
WHERE title = 'HAFTALIK_NAVBATCHILIK_JADVALI'
  AND NOT pg_temp.faculty_ok(faculty);

UPDATE public.elonlar
SET faculty = 'amit'
WHERE audience = 'floor'
  AND (faculty IS NULL OR NOT pg_temp.faculty_ok(faculty));

-- 2. Unikallik: bir fakultet + qavat + jins uchun bitta jadval qatori.
DROP INDEX IF EXISTS elonlar_duty_schedule_scope_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS elonlar_duty_schedule_scope_uidx
  ON public.elonlar ((COALESCE(faculty, 'amit')), target_floor, target_gender)
  WHERE title = 'HAFTALIK_NAVBATCHILIK_JADVALI';

-- 3. CHECK — jadval qatori endi faculty'siz bo'la olmaydi.
ALTER TABLE public.elonlar DROP CONSTRAINT IF EXISTS elonlar_duty_schedule_scope_check;
ALTER TABLE public.elonlar ADD CONSTRAINT elonlar_duty_schedule_scope_check
CHECK (
  title <> 'HAFTALIK_NAVBATCHILIK_JADVALI'
  OR (
    audience = 'internal'
    AND target_floor IS NOT NULL AND target_floor >= 1
    AND target_gender IN ('male', 'female')
    AND faculty IS NOT NULL AND faculty <> ''
  )
);

-- 4. upsert_floor_duty_schedule — fakultet SARDORning users.faculty'sidan
-- olinadi. Eski 5-argumentli versiya (p_faculty bilan) tashlab yuboriladi:
-- fakultetni tashqaridan berish soxtalashtirish imkoniyati edi.
-- SELECT / advisory lock / sardor tekshiruvi — hammasi fakultet bo'yicha.
DROP FUNCTION IF EXISTS public.upsert_floor_duty_schedule(uuid, integer, text, text, text);

CREATE OR REPLACE FUNCTION public.upsert_floor_duty_schedule(
  p_creator_id uuid,
  p_floor integer,
  p_gender text,
  p_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_faculty text;
BEGIN
  IF p_floor IS NULL OR p_floor < 1
     OR p_gender IS NULL OR p_gender NOT IN ('male', 'female')
     OR p_text IS NULL OR length(p_text) > 100000 THEN
    RAISE EXCEPTION 'Invalid duty schedule input' USING ERRCODE = '22023';
  END IF;

  PERFORM p_text::jsonb;

  -- The caller must be an active floor captain for exactly this floor/gender.
  -- Their own users.faculty is the building the roster belongs to.
  SELECT COALESCE(NULLIF(u.faculty, ''), 'amit') INTO v_faculty
  FROM public.users u
  WHERE u.id = p_creator_id
    AND u.role = 'talaba'
    AND u.status = 'active'
    AND u.is_floor_captain = true
    AND u.assigned_floor = p_floor
    AND u.gender = p_gender;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active floor captain required' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('duty-schedule:' || v_faculty || ':' || p_floor::text || ':' || p_gender, 0)
  );

  SELECT id
  INTO v_id
  FROM public.elonlar
  WHERE title = 'HAFTALIK_NAVBATCHILIK_JADVALI'
    AND COALESCE(faculty, 'amit') = v_faculty
    AND target_floor = p_floor
    AND target_gender = p_gender
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.elonlar
    SET text = p_text,
        faculty = v_faculty,
        audience = 'internal',
        type = 'Yangilik',
        is_published = true,
        created_by = p_creator_id,
        updated_at = now()
    WHERE id = v_id;
  ELSE
    INSERT INTO public.elonlar (
      title, text, type, audience, faculty, is_published, created_by, target_floor, target_gender
    )
    VALUES (
      'HAFTALIK_NAVBATCHILIK_JADVALI', p_text, 'Yangilik', 'internal', v_faculty, true, p_creator_id, p_floor, p_gender
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_floor_duty_schedule(uuid, integer, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_floor_duty_schedule(uuid, integer, text, text)
  TO service_role;
