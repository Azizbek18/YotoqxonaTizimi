-- ==========================================================
-- Bosqich 2 — tolovlar fakultet ustuni
-- ==========================================================
-- To'lov = talabaning to'lovi; talabaning fakulteti = uning binosi (housing
-- = akademik fakultet). Fakultet kodini `tolovlar`ga denormalizatsiya
-- qilamiz, shunda admin/dekan to'lov ro'yxati va "kutilayotgan" sanog'i
-- boshqa fakultet talabalarining moliyaviy hujjatlarini ko'rsatmasin, va
-- to'lovni tasdiqlash/rad etish faqat o'z fakulteti ichida bo'lsin.
--
-- Xavfsizlik: `tolovlar.faculty` yo'q edi -> global admin har fakultet
-- talabasining chek rasmi/summasi/holatini ko'rar va tasdiqlar edi. Ko'p
-- fakultetli holatda bu fakultetlararo ma'lumot sizishi + imtiyoz oshirish.

ALTER TABLE tolovlar ADD COLUMN IF NOT EXISTS faculty text;

-- Backfill: talabaning joriy fakultetidan.
UPDATE tolovlar t
SET faculty = COALESCE(NULLIF(u.faculty, ''), 'amit')
FROM users u
WHERE u.id = t.student_id AND t.faculty IS NULL;

-- Talaba o'chirilgan bo'lsa (orfan qator) — asosiy binoga.
UPDATE tolovlar SET faculty = 'amit' WHERE faculty IS NULL;

ALTER TABLE tolovlar ALTER COLUMN faculty SET NOT NULL;

-- Fakultet bo'yicha to'lov ro'yxati va (faculty, status) bo'yicha tez
-- "kutilayotgan" sanog'i (admin/dekan layout har 15 s poll qiladi).
CREATE INDEX IF NOT EXISTS tolovlar_faculty_status_idx ON tolovlar (faculty, status);

-- ---------------------------------------------------------------------
-- submit_payment_batch_atomic — INSERT'ga `faculty` qo'shiladi
-- (talabadan olinadi). Qolgan barcha tekshiruvlar 202607290000 bilan
-- bir xil.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_payment_batch_atomic(
  p_student_id uuid,
  p_student_name text,
  p_months text[],
  p_amounts integer[],
  p_year integer,
  p_receipt_url text,
  p_receipt_hash text,
  p_batch_id uuid,
  p_transaction_id text,
  p_transaction_id_normalized text
)
RETURNS TABLE(id uuid, month text, year integer, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized text;
  v_month_count integer;
  v_faculty text;
BEGIN
  v_month_count := coalesce(array_length(p_months, 1), 0);
  v_normalized := regexp_replace(upper(coalesce(p_transaction_id, '')), '[^A-Z0-9]', '', 'g');

  IF v_month_count = 0
     OR v_month_count <> coalesce(array_length(p_amounts, 1), 0)
     OR v_month_count <> (
       SELECT count(DISTINCT month_value.month)
       FROM unnest(p_months) AS month_value(month)
     )
     OR EXISTS (
       SELECT 1 FROM unnest(p_months) AS month_value(month)
       WHERE month_value.month IS NULL
          OR month_value.month NOT IN ('Sentabr', 'Oktabr', 'Noyabr', 'Dekabr', 'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun')
     )
     OR EXISTS (
       SELECT 1 FROM unnest(p_amounts) AS amount_value(amount)
       WHERE amount_value.amount IS NULL OR amount_value.amount < 1
     )
     OR p_year < 2020 OR p_year > 2100
     OR p_receipt_hash IS NULL OR p_receipt_hash !~ '^[0-9a-f]{64}$'
     OR p_transaction_id_normalized IS NULL
     OR p_transaction_id_normalized <> v_normalized
     OR length(v_normalized) < 6 OR length(v_normalized) > 128
     OR p_receipt_url IS NULL OR p_receipt_url NOT LIKE p_student_id::text || '/%'
  THEN
    RAISE EXCEPTION 'Invalid payment batch input' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(faculty, ''), 'amit') INTO v_faculty
  FROM public.users
  WHERE id = p_student_id
    AND role = 'talaba'
    AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active student required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.payment_receipt_uploads
    WHERE receipt_hash = p_receipt_hash
      AND batch_id = p_batch_id
      AND student_id = p_student_id
      AND object_path = p_receipt_url
  ) THEN
    RAISE EXCEPTION 'Receipt upload claim not found' USING ERRCODE = '23503';
  END IF;

  INSERT INTO public.payment_receipt_transactions (
    receipt_hash,
    transaction_id,
    transaction_id_normalized,
    updated_at
  )
  VALUES (
    p_receipt_hash,
    p_transaction_id,
    p_transaction_id_normalized,
    now()
  );

  RETURN QUERY
  INSERT INTO public.tolovlar (
    student_id,
    student_name,
    month,
    year,
    amount,
    status,
    receipt_url,
    receipt_hash,
    transaction_id,
    admin_message,
    faculty
  )
  SELECT
    p_student_id,
    coalesce(nullif(trim(p_student_name), ''), 'Talaba'),
    batch.month,
    p_year,
    batch.amount,
    'waiting',
    p_receipt_url,
    p_receipt_hash,
    p_transaction_id,
    'Tekshirilmoqda...',
    v_faculty
  FROM unnest(p_months, p_amounts) AS batch(month, amount)
  RETURNING tolovlar.id, tolovlar.month, tolovlar.year, tolovlar.status;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_payment_batch_atomic(
  uuid, text, text[], integer[], integer, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_batch_atomic(
  uuid, text, text[], integer[], integer, text, text, uuid, text, text
) TO service_role;
