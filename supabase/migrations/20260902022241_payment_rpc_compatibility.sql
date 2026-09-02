-- Preserve compatibility with the currently deployed application while the
-- 11-argument AI-review-aware RPC is rolled out. Legacy callers can only use
-- the verified path because a valid transaction id is still required by the
-- new implementation.
CREATE FUNCTION public.submit_payment_batch_atomic(
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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.submit_payment_batch_atomic(
    p_student_id,
    p_student_name,
    p_months,
    p_amounts,
    p_year,
    p_receipt_url,
    p_receipt_hash,
    p_batch_id,
    p_transaction_id,
    p_transaction_id_normalized,
    'passed'
  );
$$;

REVOKE ALL ON FUNCTION public.submit_payment_batch_atomic(
  uuid, text, text[], integer[], integer, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_batch_atomic(
  uuid, text, text[], integer[], integer, text, text, uuid, text, text
) TO service_role;
