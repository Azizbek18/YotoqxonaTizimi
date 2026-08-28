-- ==========================================================
-- Bosqich 5 — permit_requests: fakultetlararo PII bypass'ini yopish
-- ==========================================================
-- Tirik yagona policy "Active staff manage permit requests" (202607300002)
-- admin va tarbiyachi rollariga BARCHA fakultet permit_requests qatorlariga
-- to'g'ridan-to'g'ri PostgREST orqali FOR ALL kirish beradi. permit_requests
-- har bir arizachining pasporti, JShSHIR'i, telefoni, emaili, ota-ona
-- ma'lumotlarini saqlaydi — ya'ni faol tarbiyachi (yoki 'amit'ga bog'langan
-- admin) o'z brauzeri sessiyasi bilan butun universitet bo'ylab har
-- fakultetning arizachilari PII'sini o'qiy oladi. Server qatlamidagi
-- fakultet-scoping (features/permits/server/service.ts) hech qachon ishlamaydi.
--
-- Hech qanday mijoz kodi permit_requests'ni to'g'ridan-to'g'ri o'qimaydi —
-- barcha kirish/yozish fakultetga bog'langan Route Handler'lar orqali
-- (service-role, RLS'ni chetlab o'tadi). 202607280016 (users/arizalar) va
-- 202607290000 (qolganlari) bilan bir xil yondashuv: staff'ga qaratilgan
-- grant'ni butunlay olib tashlaymiz, jadval service-role-only bo'ladi.
--
-- Arizachining o'zi holatni /api/permit-requests/status orqali tekshiradi
-- (u ham service-role) — shuning uchun mijozga ochiq policy kerak emas.

DROP POLICY IF EXISTS "Active staff manage permit requests" ON public.permit_requests;

-- Eski nomlar ham (agar live bazada drift bo'lsa) — idempotent tozalash.
DROP POLICY IF EXISTS "Staff can manage permit requests" ON public.permit_requests;
DROP POLICY IF EXISTS "Anyone can insert permit requests" ON public.permit_requests;
DROP POLICY IF EXISTS "Anyone can select permit requests" ON public.permit_requests;

-- RLS yoqilgan holicha qoladi (202607210000). Endi mijozga ochiq policy yo'q,
-- ya'ni anon/authenticated hech qanday qatorni ko'ra olmaydi.
ALTER TABLE public.permit_requests ENABLE ROW LEVEL SECURITY;
