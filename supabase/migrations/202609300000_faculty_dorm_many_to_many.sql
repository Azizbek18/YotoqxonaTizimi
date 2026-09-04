-- ==========================================================
-- faculty_dorm: many-to-many (bir fakultet bir necha yotoqxonada)
-- ==========================================================
-- Shu paytgacha PRIMARY KEY (faculty) har fakultetni bitta yotoqxona bilan
-- cheklab turardi. Endi PRIMARY KEY (faculty, dorm_id) ga o'tamiz va har
-- fakultetning ROSA bitta qatorini is_primary deb belgilaymiz — "bu
-- fakultetning yotoqxonasi qaysi?" degan barcha mavjud qidiruvlar o'shanga
-- resolv bo'lib qolaveradi.
--
-- Bu migratsiyada hech bir fakultet ikkinchi qator OLMAYDI (buni keyingi
-- migratsiya boshlaydi — dekan boshqa binoda qavat egallaganda). Shuning
-- uchun xona RPC'laridagi har bir `SELECT dorm_id FROM faculty_dorm WHERE
-- faculty = X` skalyar so'rovi shundan keyin ham bitta qator qaytaradi.

ALTER TABLE public.faculty_dorm
  DROP CONSTRAINT faculty_dorm_pkey,
  ADD COLUMN is_primary boolean NOT NULL DEFAULT true,
  ADD CONSTRAINT faculty_dorm_pkey PRIMARY KEY (faculty, dorm_id);

-- Har fakultetда ko'pi bilan bitta primary yotoqxona.
CREATE UNIQUE INDEX faculty_dorm_one_primary
  ON public.faculty_dorm (faculty)
  WHERE is_primary;

-- Fakultetning primary yotoqxonasini almashtirish. Avval eskisini tushirib,
-- keyin yangisini ko'taramiz — shunda yuqoridagi partial unique indeks
-- oraliq holatда ham buzilmaydi.
CREATE OR REPLACE FUNCTION public.set_primary_dorm(p_faculty text, p_dorm_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.faculty_dorm WHERE faculty = p_faculty AND dorm_id = p_dorm_id
  ) THEN
    RAISE EXCEPTION 'Fakultet % bu yotoqxonaga bogʻlanmagan', p_faculty
      USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.faculty_dorm
  SET is_primary = false
  WHERE faculty = p_faculty AND dorm_id <> p_dorm_id AND is_primary;

  UPDATE public.faculty_dorm
  SET is_primary = true
  WHERE faculty = p_faculty AND dorm_id = p_dorm_id AND NOT is_primary;
END;
$$;

REVOKE ALL ON FUNCTION public.set_primary_dorm(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_primary_dorm(text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_primary_dorm(text, uuid) TO service_role;
