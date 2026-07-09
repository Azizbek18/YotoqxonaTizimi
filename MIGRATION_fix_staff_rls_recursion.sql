-- ==========================================================
-- TUZATISH v2: "staff" jadvalidagi RLS policy'da cheksiz rekursiya
-- Ushbu skriptni Supabase SQL Editor'da ishga tushiring.
--
-- v1 skript policy nomlarini TO'G'RI apostrof (') bilan qidirgan edi,
-- lekin bazada bir xil nomli, QIYSHIQ apostrof (') bilan yozilgan
-- eski, hali ham rekursiv policy'lar alohida qatorlar sifatida qolib
-- ketgan ekan (pg_policies tekshiruvi buni ko'rsatdi). Shu sabab xato
-- davom etdi. Bu versiya nom ichidagi apostrof turiga bog'liq bo'lmay,
-- prefiks bo'yicha qidirib, BARCHA eski/dublikat variantlarni tozalaydi.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM staff WHERE staff.id = uid AND staff.role = 'admin');
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, anon;

-- "Adminlar barcha xodimlarni ..." va "Xodimlar faqat o'z profilini ..."
-- bilan boshlanadigan barcha SELECT policy'larni (qaysi apostrof bilan
-- yozilganidan qat'iy nazar) tozalaymiz. "Anon email orqali..." policy'si
-- bu prefikslarga to'g'ri kelmagani uchun tegilmaydi (u allaqachon to'g'ri).
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'staff' AND cmd = 'SELECT'
      AND (
        policyname LIKE 'Adminlar barcha xodimlarni%'
        OR policyname LIKE 'Xodimlar faqat%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff', pol.policyname);
  END LOOP;
END $$;

-- Toza, bitta-bittadan, rekursiv bo'lmagan policy'larni qayta yaratamiz:
CREATE POLICY "Adminlar barcha xodimlarni ko'ra oladi"
ON public.staff FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Xodimlar faqat o'z profilini ko'ra oladi"
ON public.staff FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Tekshiruv: shu jadvalda "staff" uchun endi nechta SELECT policy
-- qolganini ko'rsatadi — natija aynan 3 ta bo'lishi kerak:
--   1. Adminlar barcha xodimlarni ko'ra oladi      (authenticated)
--   2. Xodimlar faqat o'z profilini ko'ra oladi     (authenticated)
--   3. Anon email orqali mavjudligini tekshiradi    (anon)
SELECT policyname, cmd, roles FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'staff' AND cmd = 'SELECT'
ORDER BY policyname;
