-- ==========================================================
-- Blokli bino seksiya granti — faculty_dorm bog'lanishi yo'q edi
-- ==========================================================
-- Muammo (jonli holatda topildi, 7-yotoqxona): superadmin
-- dorm_assign_section orqali A11/A12 seksiyasini "iqtisodiyot"
-- fakultetiga bergan, lekin bu faqat dorm_section jadvaliga yozadi.
-- Dekan panelidagi "Blok xonalari" (dekanBlockedSections) dorm_section'ni
-- to'g'ridan-to'g'ri o'qigani uchun xonalarni KO'RSATADI — lekin
-- assign_student_room_atomic / assign_permit_room_atomic har doim
-- p_dorm_id berilganda AVVAL faculty_dorm'da shu (fakultet, bino) juftligi
-- borligini tekshiradi (P0002 "Dorm does not belong to faculty"). Bu juftlik
-- yo'q edi, shuning uchun har qanday xonaga joylashtirish "Bunday xona
-- xonalar sxemasida topilmadi" bilan muvaffaqiyatsiz tugardi — xona
-- haqiqatan mavjud bo'lsa ham.
--
-- 'simple' bino xona granti (dorm_grant_room, 202609300012) buni to'g'ri
-- qiladi: grant berilganda faculty_dorm'ga ham yozadi. dorm_assign_section
-- ('blocked' bino uchun ekvivalenti) buni qilmagan edi — shu farq committed.
--
-- Yechim: dorm_assign_section endi dorm_grant_room kabi faculty_dorm'ga
-- (is_primary=false) yozadi + mavjud dorm_section qatorlari uchun bir
-- martalik backfill.

CREATE OR REPLACE FUNCTION public.dorm_assign_section(
  p_dorm_id uuid, p_block text, p_floor int, p_faculty text, p_staff_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_layout text; v_blocks smallint; v_floors int; v_block text; v_conflict int;
BEGIN
  IF p_dorm_id IS NULL OR p_block IS NULL OR p_floor IS NULL
     OR p_faculty IS NULL OR btrim(p_faculty) = '' THEN
    RAISE EXCEPTION 'Invalid arguments' USING ERRCODE = '22023';
  END IF;

  SELECT layout_kind, block_count, floor_count INTO v_layout, v_blocks, v_floors
  FROM public.dorms WHERE id = p_dorm_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dorm not found' USING ERRCODE = 'P0002'; END IF;
  IF v_layout <> 'blocked' THEN
    RAISE EXCEPTION 'Dorm is not a blocked-layout building' USING ERRCODE = 'P0001';
  END IF;

  v_block := upper(btrim(p_block));
  IF v_block !~ '^[A-Z]$' OR v_block > chr(64 + v_blocks) THEN
    RAISE EXCEPTION 'Block % is outside A..%', p_block, chr(64 + v_blocks) USING ERRCODE = '22023';
  END IF;
  IF p_floor < 1 OR p_floor > v_floors THEN
    RAISE EXCEPTION 'Floor % is outside 1..%', p_floor, v_floors USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_dorm_id::text || ':section'));

  SELECT count(*) INTO v_conflict FROM public.users
  WHERE role = 'talaba' AND dorm_id = p_dorm_id AND block = v_block
    AND assigned_floor = p_floor
    AND COALESCE(NULLIF(btrim(faculty), ''), 'amit') <> p_faculty;
  IF v_conflict > 0 THEN
    RAISE EXCEPTION 'Section %/% still has % resident(s) from another faculty', v_block, p_floor, v_conflict
      USING ERRCODE = 'P0003';
  END IF;

  INSERT INTO public.dorm_section (dorm_id, block, floor_number, faculty, assigned_by)
  VALUES (p_dorm_id, v_block, p_floor, p_faculty, p_staff_id)
  ON CONFLICT (dorm_id, block, floor_number) DO UPDATE SET
    faculty = EXCLUDED.faculty, assigned_by = EXCLUDED.assigned_by, updated_at = now();

  -- Grantee dekani binoni ko'rishi VA unga joylashtira olishi uchun
  -- faculty_dorm bog'lanishi ham yaratiladi (dorm_grant_room bilan bir xil
  -- naqsh) — assign_*_room_atomic p_dorm_id berilganda shuni tekshiradi.
  INSERT INTO public.faculty_dorm (faculty, dorm_id, is_primary)
  VALUES (p_faculty, p_dorm_id, false)
  ON CONFLICT (faculty, dorm_id) DO NOTHING;

  -- floor_room_layout.faculty ni seksiya egasiga tenglashtiramiz (o'qish qulayligi).
  UPDATE public.floor_room_layout
  SET faculty = p_faculty
  WHERE dorm_id = p_dorm_id AND block = v_block AND floor_number = p_floor
    AND faculty <> p_faculty;

  RETURN jsonb_build_object('block', v_block, 'floor', p_floor, 'faculty', p_faculty);
END;
$$;

-- Backfill: allaqachon dorm_section'da turgan, lekin faculty_dorm'da
-- juftligi yo'q har bir (fakultet, bino) uchun bog'lanish qo'shamiz —
-- shu migratsiyagacha berilgan seksiya grantlari (masalan 7-yotoqxona
-- A11/A12 → iqtisodiyot, A7/A8 → ozbek-filologiyasi) uchun tuzatish.
INSERT INTO public.faculty_dorm (faculty, dorm_id, is_primary)
SELECT DISTINCT ds.faculty, ds.dorm_id, false
FROM public.dorm_section ds
ON CONFLICT (faculty, dorm_id) DO NOTHING;

REVOKE ALL ON FUNCTION public.dorm_assign_section(uuid, text, int, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dorm_assign_section(uuid, text, int, text, uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dorm_assign_section(uuid, text, int, text, uuid) TO service_role;
