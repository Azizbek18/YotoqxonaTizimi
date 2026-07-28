-- /api/ai/tahlil previously did a SELECT (check for an existing mapping)
-- followed by a separate UPSERT — not atomic. Two concurrent analyses of
-- the SAME receipt (double-submitted requests, or a retry racing the
-- original) could both run the SELECT before either UPSERT commits, both
-- see "no existing mapping", and both proceed — the second one silently
-- overwrites whatever the first one just wrote, exactly the "AI
-- disagreement" case the SELECT was meant to catch. The SELECT's error was
-- also never checked, so a transient failure there would silently fall
-- through as "no mapping" too.
--
-- Move the whole compare-and-set into a single function: take a per-
-- receipt advisory lock, then check/insert/update inside the same
-- transaction. This serializes concurrent claims for the same receipt_hash
-- entirely (no PK race possible), while genuine cross-receipt duplicates
-- still hit the transaction_id_normalized UNIQUE index and surface as a
-- unique_violation.
CREATE OR REPLACE FUNCTION public.claim_receipt_transaction(
  p_receipt_hash text,
  p_transaction_id text,
  p_transaction_id_normalized text
)
RETURNS TABLE(stored_transaction_id_normalized text, is_conflict boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing text;
BEGIN
  -- Distinct namespace (135792468) from the room-number locks
  -- (single-bigint hashtext(room_number)) and the floor-layout locks
  -- (987654321, floor_number) used elsewhere — a same-value collision
  -- with those would only cause extra waiting, never incorrect behavior,
  -- but keeping lock classes namespaced avoids it entirely.
  PERFORM pg_advisory_xact_lock(135792468, hashtext(p_receipt_hash));

  SELECT transaction_id_normalized INTO v_existing
  FROM payment_receipt_transactions
  WHERE receipt_hash = p_receipt_hash;

  IF NOT FOUND THEN
    BEGIN
      INSERT INTO payment_receipt_transactions (receipt_hash, transaction_id, transaction_id_normalized, updated_at)
      VALUES (p_receipt_hash, p_transaction_id, p_transaction_id_normalized, now());
    EXCEPTION WHEN unique_violation THEN
      RETURN QUERY SELECT p_transaction_id_normalized, true;
      RETURN;
    END;
    RETURN QUERY SELECT p_transaction_id_normalized, false;
    RETURN;
  END IF;

  IF v_existing = p_transaction_id_normalized OR v_existing = '' THEN
    UPDATE payment_receipt_transactions
    SET transaction_id = p_transaction_id, transaction_id_normalized = p_transaction_id_normalized, updated_at = now()
    WHERE receipt_hash = p_receipt_hash;
    RETURN QUERY SELECT p_transaction_id_normalized, false;
    RETURN;
  END IF;

  -- This same receipt already has a different value on file (a previous
  -- analysis claimed it) — leave it untouched and report back what's
  -- actually stored, rather than overwriting.
  RETURN QUERY SELECT v_existing, false;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_receipt_transaction(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_receipt_transaction(text, text, text) TO service_role;
