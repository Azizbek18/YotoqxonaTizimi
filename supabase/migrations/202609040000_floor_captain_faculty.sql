-- ==========================================================
-- Bosqich 1f (1/2) — qavat sardori fakultet bo'yicha
-- ==========================================================
-- Sardor (qavat kapitani) — jismoniy qavatning roli. Har fakultet o'z
-- binosiga ega bo'lgach, "3-qavat, o'g'il" sardori har binoda ALOHIDA
-- bo'ladi. Sardorning fakulteti = `users.faculty` (uning binosi).
--
-- Xavfsizlik: fakultetsiz bo'lsa boshqa binoning sardorini almashtirib
-- yuborish yoki bir jismoniy qavatga bir necha "sardor" tayinlash mumkin
-- bo'lardi. Quyida unikallik indeksi ham, promote funksiyasi ham fakultet
-- bo'yicha cheklanadi. Fakultetsiz talaba 'amit' binosiga tegishli deb
-- olinadi (PRIMARY_FACULTY zaxira mantig'i bilan bir xil).

-- Unikallik: (faculty, assigned_floor, gender). coalesce funktsional
-- indeks — NULL faculty ham 'amit' deb qaraladi, aks holda ikkita
-- NULL-fakultetli sardor bir qavatda yashab qolardi (NULL = NULL emas).
DROP INDEX IF EXISTS users_floor_captain_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS users_floor_captain_unique_idx
  ON public.users ((COALESCE(NULLIF(faculty, ''), 'amit')), assigned_floor, gender)
  WHERE is_floor_captain = true;

-- promote_floor_captain — maqsad talabaning fakultetini o'qiydi, avvalgi
-- sardorni FAQAT o'sha fakultet + qavat + jins bo'yicha tushiradi, advisory
-- lock kalitiga ham fakultetni qo'shadi. Boshqa qismi 202607280017 bilan
-- bir xil (maqsadni oldin FOR UPDATE bilan tekshiradi).
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
DECLARE
  v_faculty text;
BEGIN
  SELECT COALESCE(NULLIF(faculty, ''), 'amit') INTO v_faculty
  FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user does not exist' USING ERRCODE = 'P0001';
  END IF;

  IF p_is_captain AND p_assigned_floor IS NOT NULL AND p_gender IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(
      hashtext('floor-captain:' || v_faculty || ':' || p_assigned_floor::text || ':' || p_gender)
    );

    UPDATE public.users
    SET is_floor_captain = false
    WHERE is_floor_captain = true
      AND COALESCE(NULLIF(faculty, ''), 'amit') = v_faculty
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
REVOKE EXECUTE ON FUNCTION public.promote_floor_captain(uuid, int, text, boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_floor_captain(uuid, int, text, boolean) TO service_role;
