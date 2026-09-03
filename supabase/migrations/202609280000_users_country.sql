-- ==========================================================
-- users.country — imtiyozli (xorijiy) talabalar kelib chiqqan davlati
-- ==========================================================
-- Xorijiy fuqaro registratsiyada O'zbekiston viloyat/tuman/MFY manzilini
-- kiritmaydi (Step5Address o'tkazib yuboriladi). Imtiyozli ariza allaqachon
-- `permit_requests.origin_country` + `origin_region` ni olib bo'lgan;
-- registratsiya route'i ularni `users` ga ko'chiradi:
--   region  = origin_region
--   country = origin_country   (yangi ustun — pastda)
--   district / mahalla = NULL
--
-- `district` ni davlat sifatida ishlatib bo'lmadi: u xodimlarga "Tuman"
-- ustuni sifatida ko'rinadi (lib/student-report-table.ts), davlat u yerda
-- noto'g'ri ma'lumot bo'lardi. Nullable additive ustun — backfill/constraint
-- yo'q, nol xavf.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS country text;

COMMENT ON COLUMN public.users.country IS
  'Imtiyozli talabalar: permit_requests.origin_country dan ko''chiriladi. Mahalliy talabalar uchun NULL.';
