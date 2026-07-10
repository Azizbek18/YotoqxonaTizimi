-- ==========================================================
-- KUCHAYTIRISH: Chek dublikatini aniqlashni mustahkamlash
-- Ushbu skriptni Supabase SQL Editor'da ishga tushiring.
--
-- Muammo: /api/ai/tekshiruv AI orqali "haqiqiy yoki soxta" deb
-- baholaydi, lekin bu baho faqat rasm chekka o'xshab ko'rinishiga
-- asoslangan — Click/Payme serverlariga murojaat qilib tranzaksiya
-- haqiqatan bo'lganini tekshira olmaydi. Shu sababli:
--   1. Bir xil rasm fayli qayta yuklansa (masalan boshqa talaba
--      birovning chekini saqlab olib qayta yuklasa), avvalgi
--      tekshiruv buni faqat transaction_id orqali ushlagan, lekin
--      transaction_id solishtirish katta-kichik harf/bo'shliq/
--      belgilarga sezgir edi — "TX-778812340" va "tx778812340"
--      turlicha qatorlar sifatida ko'rilib, dublikat sifatida
--      aniqlanmasdi.
--   2. AI misol sifatida ko'rsatgan yoki oson o'ylab topiladigan
--      transaction_id'lar (masalan "TX12345678", ketma-ket raqamlar)
--      hech qanday qo'shimcha tekshiruvsiz qabul qilinardi.
--
-- Yechim: fayl darajasida SHA-256 xesh orqali aniq dublikatni
-- aniqlash (AI natijasidan mustaqil, 100% ishonchli) va
-- transaction_id uchun normallashtirilgan ustun qo'shish.
-- ==========================================================

ALTER TABLE tolovlar
ADD COLUMN IF NOT EXISTS receipt_hash text;

ALTER TABLE tolovlar
ADD COLUMN IF NOT EXISTS transaction_id_normalized text
  GENERATED ALWAYS AS (regexp_replace(upper(coalesce(transaction_id, '')), '[^A-Z0-9]', '', 'g')) STORED;

CREATE INDEX IF NOT EXISTS tolovlar_receipt_hash_idx
  ON tolovlar(receipt_hash) WHERE receipt_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS tolovlar_transaction_id_normalized_idx
  ON tolovlar(transaction_id_normalized) WHERE transaction_id_normalized <> '';

COMMENT ON COLUMN tolovlar.receipt_hash IS 'Yuklangan chek faylining SHA-256 xeshi (bir xil rasmning qayta yuklanishini AI natijasidan mustaqil ravishda aniqlash uchun)';
COMMENT ON COLUMN tolovlar.transaction_id_normalized IS 'transaction_id ning normallashtirilgan (katta harf, faqat harf/raqam) shakli (katta-kichik harf, bosh joy, belgilar orqali dublikat tekshiruvidan qochishning oldini oladi)';
