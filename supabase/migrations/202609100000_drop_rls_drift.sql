-- ==========================================================
-- Bosqich 5 — jonli bazadagi RLS drift'ini tozalash
-- ==========================================================
-- verify-rls.sql ni production'da yuritganda (2026-08-28) migratsiya
-- fayllarida MAVJUD BO'LMAGAN policy'lar topildi — ular dashboard orqali
-- qo'lda qo'shilgan (202607280018 dagi "anyone_can_read_users" hodisasi
-- bilan bir xil sinf). Eng jiddiylari:
--
--   * users."users_can_update_themselves" (UPDATE, USING auth.uid()=id,
--     ustun cheklovi YO'Q) — istalgan tizimga kirgan talaba o'z `users`
--     qatorini to'g'ridan-to'g'ri REST orqali PATCH qilib
--     role='admin' / status='active' / is_floor_captain=true /
--     blacklisted=false / warning_count=0 / room_number=... / faculty=...
--     qila oladi. Jonli imtiyoz oshirish teshigi.
--   * arizalar."Admins can view all arizalar" (SELECT) — o'zi yoziladigan
--     users.role ga ishonadi; yuqoridagi bilan zanjirlansa talaba HAR
--     fakultetning arizalari + shaxsiy admin-talaba chatini o'qiy oladi.
--   * users."users_can_insert_self" / "Allow individual insert" — takror
--     INSERT policy'lari; ixtiyoriy role bilan o'z qatorini yaratish
--     (permit-tasdiq trigger'i faqat role='talaba' ni to'sadi).
--   * arizalar."Zamdekan can update all applications" — 'zamdekan' roli
--     202607300002 da 'dekan' ga o'zgargan; bugun 0 xodim mos keladi, ammo
--     202607290000 uni olib tashlashi kerak edi.
--   * public.bemorlar — hech bir migratsiyada yo'q sinov jadvali
--     (id, created_at, ism, familya, yosh; 1 qator). SELECT hammaga (true),
--     INSERT anon'ga ochiq.
--
-- Barcha yozish/staff-keng o'qish validatsiyalangan Route Handler'lar
-- (service-role, RLS'ni chetlab o'tadi) orqali bo'ladi va hech qanday
-- mijoz kodi `users`/`arizalar` ni to'g'ridan-to'g'ri yozmaydi (202607280016
-- da tekshirilgan) — shuning uchun bularni olib tashlash xavfsiz.
--
-- ⚠️ Bu migratsiya mustaqil: 202609010000–202609090000 ga bog'liq emas va
-- production'ga DARHOL, boshqalaridan oldin qo'llanishi mumkin/lozim.

-- --- users: faqat "Users can view own user profile" (SELECT own-row) qoladi
DROP POLICY IF EXISTS "users_can_update_themselves" ON public.users;
DROP POLICY IF EXISTS "users_can_insert_self" ON public.users;
DROP POLICY IF EXISTS "Allow individual insert" ON public.users;
DROP POLICY IF EXISTS "Users can update own user profile" ON public.users;

-- --- arizalar: faqat "Users can view relevant applications" (SELECT own-row) qoladi
DROP POLICY IF EXISTS "Admins can view all arizalar" ON public.arizalar;
DROP POLICY IF EXISTS "Zamdekan can update all applications" ON public.arizalar;
DROP POLICY IF EXISTS "Users can view their own arizalar" ON public.arizalar;

-- --- staff: faqat "Staff can view own staff profile" qoladi. Ikkinchi
-- (takror) policy nomida apostrof bor — ba'zi SQL muharrirlari uni buzadi,
-- shuning uchun nomni yozmasdan pg_policies dan topib o'chiramiz.
DO $$
DECLARE p text;
BEGIN
  FOR p IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'staff' AND policyname LIKE 'Xodimlar%'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.staff', p);
  END LOOP;
END $$;

-- --- profiles: legacy, ilovada ishlatilmaydi — takror own-row policy olib tashlanadi
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- --- bemorlar: hech bir migratsiyada yo'q sinov jadvali
DROP TABLE IF EXISTS public.bemorlar;

-- RLS hamma joyda yoqilgan holicha qoladi (verify-rls.sql: 14/14 rls_on=true).
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arizalar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
