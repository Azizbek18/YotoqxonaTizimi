-- ==========================================================
-- Bosqich 2a — talabalarda bo'sh fakultetni to'ldirish
-- ==========================================================
-- Fakultet endi ijara chegarasi: admin/dekan talabalar ro'yxati, xona,
-- to'lov, e'lon — hammasi `users.faculty` bo'yicha. Bosqich 0
-- (202609010000) erkin yozilgan imlolarni kanonik kodga keltirdi, lekin
-- NULL/bo'sh qatorlar qoldi (eski ro'yxatdan o'tishlar, import). Ular hech
-- bir fakultet ko'rinishiga tushmay qolmasin — asosiy binoga biriktiramiz.
--
-- Xavfsizlik nuqtai nazaridan xavfsiz: 'amit' allaqachon eng ko'p talaba
-- bo'lgan bino; noto'g'ri biriktirilgan qator bo'lsa, uni admin/DB orqali
-- to'g'rilash mumkin.

UPDATE public.users
SET faculty = 'amit'
WHERE role = 'talaba'
  AND (faculty IS NULL OR trim(faculty) = '');
