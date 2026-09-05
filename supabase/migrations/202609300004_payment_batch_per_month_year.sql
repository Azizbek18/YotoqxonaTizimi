-- ==========================================================
-- chek-yuklash oy tanlovi: o'quv yili (Sentabr->Iyun), yil kesishuvi
-- ==========================================================
-- The dorm billing year runs Sentabr->Iyun (no charge for the Iyul/Avgust
-- summer break). A student picking, say, Noyabr+Dekabr+Yanvar+Fevral in one
-- upload spans TWO real calendar years — Noyabr/Dekabr belong to the
-- academic year's own start year, Yanvar/Fevral roll into the next one.
-- submit_payment_batch_atomic used to take a single `p_year integer` applied
-- to every row in the batch, so a batch spanning that boundary would have
-- silently stamped the wrong calendar year on half its rows. `tolovlar`
-- itself was always fine with this (its unique index is already
-- (student_id, month, year) — per-row, not per-batch), only the RPC's
-- parameter list assumed one shared year.
--
-- p_year integer -> p_years integer[], one entry per p_months/p_amounts
-- entry (same unnest triple). The app derives each entry from the picked
-- academic year's start (calendarYearForPaymentMonth) — never trusts a raw
-- per-month year from the client.
--
-- Also drops the old 10-arg compatibility overload (20260902022241): it was
-- a thin `p_ai_review := 'passed'` forwarding wrapper kept only for a caller
-- that no longer exists (features/payments/server/repository.ts always
-- passes p_ai_review) — confirmed dead code, and keeping it around would
-- leave a second, now-inconsistent single-p_year overload sitting next to
-- the real one.

DROP FUNCTION IF EXISTS public.submit_payment_batch_atomic(
  uuid, text, text[], integer[], integer, text, text, uuid, text, text
);
DROP FUNCTION IF EXISTS public.submit_payment_batch_atomic(
  uuid, text, text[], integer[], integer, text, text, uuid, text, text, text
);

CREATE FUNCTION public.submit_payment_batch_atomic(
  p_student_id uuid,
  p_student_name text,
  p_months text[],
  p_amounts integer[],
  p_years integer[],
  p_receipt_url text,
  p_receipt_hash text,
  p_batch_id uuid,
  p_transaction_id text,
  p_transaction_id_normalized text,
  p_ai_review text
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
     OR v_month_count <> coalesce(array_length(p_years, 1), 0)
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
     OR EXISTS (
       SELECT 1 FROM unnest(p_years) AS year_value(year)
       WHERE year_value.year IS NULL OR year_value.year < 2020 OR year_value.year > 2100
     )
     OR p_receipt_hash IS NULL OR p_receipt_hash !~ '^[0-9a-f]{64}$'
     OR p_ai_review IS NULL OR p_ai_review NOT IN ('passed', 'manual')
     OR (
       p_ai_review = 'passed'
       AND (
         p_transaction_id_normalized IS NULL
         OR p_transaction_id_normalized <> v_normalized
         OR length(v_normalized) < 6
         OR length(v_normalized) > 128
       )
     )
     OR (
       p_ai_review = 'manual'
       AND (coalesce(p_transaction_id, '') <> '' OR coalesce(p_transaction_id_normalized, '') <> '')
     )
     OR p_receipt_url IS NULL OR p_receipt_url NOT LIKE p_student_id::text || '/%'
  THEN
    RAISE EXCEPTION 'Invalid payment batch input' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(NULLIF(faculty, ''), 'amit') INTO v_faculty
  FROM public.users
  WHERE users.id = p_student_id
    AND users.role = 'talaba'
    AND users.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active student required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.payment_receipt_uploads AS upload_claim
    WHERE upload_claim.receipt_hash = p_receipt_hash
      AND upload_claim.batch_id = p_batch_id
      AND upload_claim.student_id = p_student_id
      AND upload_claim.object_path = p_receipt_url
  ) THEN
    RAISE EXCEPTION 'Receipt upload claim not found' USING ERRCODE = '23503';
  END IF;

  IF p_ai_review = 'passed' THEN
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
  END IF;

  RETURN QUERY
  INSERT INTO public.tolovlar AS inserted_payment (
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
    faculty,
    ai_review
  )
  SELECT
    p_student_id,
    coalesce(nullif(trim(p_student_name), ''), 'Talaba'),
    batch.month,
    batch.year,
    batch.amount,
    'waiting',
    p_receipt_url,
    p_receipt_hash,
    nullif(p_transaction_id, ''),
    'Tekshirilmoqda...',
    v_faculty,
    p_ai_review
  FROM unnest(p_months, p_amounts, p_years) AS batch(month, amount, year)
  RETURNING inserted_payment.id, inserted_payment.month,
            inserted_payment.year, inserted_payment.status;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_payment_batch_atomic(
  uuid, text, text[], integer[], integer[], text, text, uuid, text, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_batch_atomic(
  uuid, text, text[], integer[], integer[], text, text, uuid, text, text, text
) TO service_role;
