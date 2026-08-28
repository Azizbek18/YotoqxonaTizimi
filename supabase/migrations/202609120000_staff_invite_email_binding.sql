-- ==========================================================
-- Tarbiyachi taklif kodini emailga bog'lash
-- ==========================================================
-- Ilgari dekan umumiy taklif kodi yaratardi va istagan odam istagan email
-- bilan ro'yxatdan o'tardi. Endi dekan FAQAT bitta email kiritadi, kod
-- aynan shu emailga bog'lanadi va bir martalik bo'ladi. Yangi tarbiyachi
-- qolgan hamma narsani (F.I.Sh., telefon, jins, parol) o'zi kiritadi;
-- email va fakultet koddan olinadi.
--
-- staff_invites.email:
--   * tarbiyachi kodi  -> to'ldirilgan (aynan shu email ro'yxatdan o'tadi)
--   * umumiy dekan kodi -> NULL (dekan emailini o'zi kiritadi)
-- staff.gender: tarbiyachi ro'yxatdan o'tishda jinsini kiritadi.

ALTER TABLE public.staff_invites ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS gender text;

-- Bitta email uchun bir vaqtning o'zida faqat bitta "kutilayotgan" (bekor
-- qilinmagan, hali ishlatilmagan) kod bo'lsin — dekan bexosdan bir necha
-- kod yuborib qo'ymasin. Muddat tekshiruvi indeksga kiritilmaydi
-- (now() immutable emas); uni service qatlami va claim funksiyasi qiladi.
CREATE UNIQUE INDEX IF NOT EXISTS staff_invites_one_pending_per_email
  ON public.staff_invites (lower(email))
  WHERE email IS NOT NULL AND revoked_at IS NULL AND use_count = 0;

-- claim_staff_invite endi kodning emailini ham qaytaradi va emailga
-- bog'langan kod uchun o'sha email allaqachon xodim bo'lsa —
-- use_count sarflamasdan rad etadi.
DROP FUNCTION IF EXISTS public.claim_staff_invite(text);

CREATE FUNCTION public.claim_staff_invite(p_code_hash text)
RETURNS TABLE (faculty text, role text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_faculty text;
  v_role text;
  v_email text;
BEGIN
  SELECT i.id, i.faculty, i.role, i.email
  INTO v_id, v_faculty, v_role, v_email
  FROM public.staff_invites i
  WHERE i.code_hash = p_code_hash
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
    AND (i.max_uses IS NULL OR i.use_count < i.max_uses)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired staff invite' USING ERRCODE = 'P0001';
  END IF;

  -- Emailga bog'langan kod: o'sha email allaqachon band bo'lsa, kodni
  -- sarflamay to'xtaymiz (RAISE butun funksiyani orqaga qaytaradi).
  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.staff s WHERE lower(s.email) = lower(v_email)
  ) THEN
    RAISE EXCEPTION 'Email already registered' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.staff_invites SET use_count = use_count + 1 WHERE id = v_id;

  RETURN QUERY SELECT v_faculty, v_role, v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_staff_invite(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_staff_invite(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_staff_invite(text) TO service_role;
