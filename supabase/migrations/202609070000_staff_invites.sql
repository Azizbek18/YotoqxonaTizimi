-- ==========================================================
-- Bosqich 3 — dekan tomonidan xodim taklif kodlari
-- ==========================================================
-- Dekan (= fakultet admini) o'z panelida maxfiy taklif kodi yaratadi va
-- uni fakultetning tarbiyachi/co-dekanlariga beradi. Yangi xodim shu kod
-- bilan ro'yxatdan o'tsa — akkaunti avtomatik o'sha FAKULTETga va
-- KODdagi rolga bog'lanadi (fakultetni yoki rolni tashqaridan tanlab
-- bo'lmaydi).
--
-- Kod hech qachon ochiq saqlanmaydi — faqat sha256 xeshi (`code_hash`).
-- Kod qayta ishlatiladigan (bir necha xodim), muddatli va bekor
-- qilinadigan.
--
-- Eski (202607280014 da tashlab yuborilgan) admin_invites/staff_invites
-- bilan aloqasi yo'q — bu butunlay yangi, dekan-egaligidagi jadval.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS staff_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text UNIQUE NOT NULL,
  faculty text NOT NULL,
  role text NOT NULL CHECK (role IN ('tarbiyachi', 'dekan')),
  label text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  revoked_at timestamptz,
  max_uses integer CHECK (max_uses IS NULL OR max_uses >= 1),
  use_count integer NOT NULL DEFAULT 0 CHECK (use_count >= 0)
);

CREATE INDEX IF NOT EXISTS staff_invites_faculty_idx ON staff_invites (faculty, created_at DESC);

ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;
-- Mijozga ochiq policy yo'q: faqat service-role kaliti (/api/dekan/staff-invites
-- boshqarish, /api/staff/register tekshirish) tegadi. Bir dekan boshqa
-- fakultet kodini ko'ra/o'zgartira olmasligi service qatlamida (staff.faculty
-- bo'yicha) ta'minlanadi.

-- Faol taklifni topish uchun atomik "claim" funksiyasi: kodni tekshiradi,
-- muddat/bekor/limit holatini ko'radi, use_count ni bir zarbada oshiradi va
-- (faculty, role) ni qaytaradi. Ro'yxatdan o'tish route'i buni chaqiradi.
CREATE OR REPLACE FUNCTION public.claim_staff_invite(p_code_hash text)
RETURNS TABLE (faculty text, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_faculty text;
  v_role text;
BEGIN
  SELECT i.id, i.faculty, i.role
  INTO v_id, v_faculty, v_role
  FROM public.staff_invites i
  WHERE i.code_hash = p_code_hash
    AND i.revoked_at IS NULL
    AND i.expires_at > now()
    AND (i.max_uses IS NULL OR i.use_count < i.max_uses)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired staff invite' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.staff_invites SET use_count = use_count + 1 WHERE id = v_id;

  RETURN QUERY SELECT v_faculty, v_role;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_staff_invite(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_staff_invite(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_staff_invite(text) TO service_role;
