-- ==========================================================
-- Bosqich 2a — arizalar.faculty to'ldirish + indeks
-- ==========================================================
-- `arizalar.faculty` boshidan mavjud va barcha yozuv yo'llari (talaba
-- arizasi, chat, ogohlantirish RPC) uni to'ldiradi. Lekin eski yoki
-- orfan qatorlarda NULL bo'lishi mumkin. Admin/dekan ariza ro'yxati va
-- chat endi shu ustun bo'yicha cheklanadi, shuning uchun NULL qolgan
-- qatorlarni talabaning fakultetidan (yoki 'amit') to'ldiramiz.
--
-- Xavfsizlik: fakultet filtri bo'lmasa global admin har fakultet
-- talabasining arizasi/chatini ko'radi va boshqaradi.

UPDATE public.arizalar a
SET faculty = COALESCE(NULLIF(u.faculty, ''), 'amit')
FROM public.users u
WHERE u.id = a.student_id
  AND (a.faculty IS NULL OR a.faculty = '');

UPDATE public.arizalar
SET faculty = 'amit'
WHERE faculty IS NULL OR faculty = '';

-- Admin/dekan ariza ro'yxati: type IN ('ariza','tushuntirish'),
-- status <> 'draft', fakultet bo'yicha, created_at DESC.
CREATE INDEX IF NOT EXISTS arizalar_faculty_type_idx ON public.arizalar (faculty, type);
