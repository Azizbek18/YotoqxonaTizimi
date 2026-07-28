-- 1. 202607280020 revoked EXECUTE on update_warning_count(), a function
-- that (like the schema drift found earlier) exists on this specific live
-- database but was never created by anything in this repo's migrations.
-- On a database built from scratch from this migration history, that
-- REVOKE would fail with "function does not exist", aborting the whole
-- migration. Guard it the same way 202607280014 guards its column check —
-- only touch it if it actually exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_warning_count' AND pg_get_function_identity_arguments(p.oid) = ''
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.update_warning_count() FROM PUBLIC, anon, authenticated';
  END IF;
END $$;

-- 2. 202607280021 revoked the default EXECUTE grant from `anon` and
-- `authenticated` specifically, but PostgreSQL's actual built-in default
-- for new functions is EXECUTE granted to PUBLIC — and every role
-- (including anon/authenticated) automatically has whatever PUBLIC has,
-- regardless of any REVOKE targeted at them by name. Revoking from the
-- named roles never touched that. Per PostgreSQL's own ALTER DEFAULT
-- PRIVILEGES documentation, the correct target is PUBLIC, and the form
-- that reliably overrides the built-in per-role default is the
-- schema-less (global) one, not IN SCHEMA public.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Also close the same gap for every function already created before this
-- fix that still carries the implicit PUBLIC grant (the 4 trigger
-- functions never had their own REVOKE ALL FROM PUBLIC — trigger functions
-- can't actually be invoked directly by anything other than the trigger
-- mechanism itself, since Postgres rejects direct calls to a `RETURNS
-- trigger` function, but there's no reason to leave the grant sitting
-- there regardless).
REVOKE EXECUTE ON FUNCTION public.check_student_permit_approved() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_application_moderation_fields() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_elonlar_updated_at() FROM PUBLIC;

-- 3. /api/ai/tahlil claimed the transaction id (via claim_receipt_transaction)
-- and then updated tolovlar's status='waiting'-conditioned row as two
-- separate statements. If the payment got decided in the gap between them
-- (or the second statement errored), the claim in
-- payment_receipt_transactions was already committed and stayed
-- permanently reserved for a payment whose audit fields never actually
-- got written — which could then wrongly flag a legitimate future
-- analysis of the same real receipt as a duplicate. Combine both into one
-- function: lock and verify status='waiting' FIRST, before claiming
-- anything, so neither write happens unless both can.
CREATE OR REPLACE FUNCTION public.finalize_payment_analysis(
  p_payment_id uuid,
  p_receipt_hash text,
  p_transaction_id text,
  p_transaction_id_normalized text,
  p_ai_confidence int,
  p_ai_extracted_amount int,
  p_ai_analysis text
)
RETURNS TABLE(applied boolean, is_conflict boolean, final_confidence int, final_analysis text, final_transaction_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing text;
  v_confidence int := p_ai_confidence;
  v_analysis text := p_ai_analysis;
  v_transaction_id text := p_transaction_id;
  v_is_conflict boolean := false;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tolovlar WHERE id = p_payment_id AND status = 'waiting' FOR UPDATE) THEN
    RETURN QUERY SELECT false, false, p_ai_confidence, p_ai_analysis, p_transaction_id;
    RETURN;
  END IF;

  IF p_transaction_id_normalized <> '' THEN
    PERFORM pg_advisory_xact_lock(135792468, hashtext(p_receipt_hash));

    SELECT transaction_id_normalized INTO v_existing
    FROM payment_receipt_transactions
    WHERE receipt_hash = p_receipt_hash;

    IF NOT FOUND THEN
      BEGIN
        INSERT INTO payment_receipt_transactions (receipt_hash, transaction_id, transaction_id_normalized, updated_at)
        VALUES (p_receipt_hash, p_transaction_id, p_transaction_id_normalized, now());
      EXCEPTION WHEN unique_violation THEN
        v_is_conflict := true;
      END;
    ELSIF v_existing <> p_transaction_id_normalized AND v_existing <> '' THEN
      -- This same receipt already has a different value on file from a
      -- previous analysis — don't overwrite it, flag for manual review.
      v_confidence := 10;
      v_transaction_id := NULL;
      v_analysis := '⚠️ AI bu chekdan oldingi tahlildan farqli tranzaksiya raqamini aniqladi. Qo''lda tekshiruv talab qilinadi.';
    ELSE
      UPDATE payment_receipt_transactions
      SET transaction_id = p_transaction_id, transaction_id_normalized = p_transaction_id_normalized, updated_at = now()
      WHERE receipt_hash = p_receipt_hash;
    END IF;

    IF v_is_conflict THEN
      v_confidence := 10;
      v_transaction_id := NULL;
      v_analysis := format(
        '⚠️ DIQQAT: TAKRORAN YUKLANGAN CHEK (DUPLICATE DETECTION)! %s%sUshbu chekdagi tranzaksiya raqami (%s) tizimdagi boshqa to''lovda allaqachon ro''yxatdan o''tgan! Soxtalik va firibgarlik ehtimoli juda yuqori.',
        chr(10), chr(10), p_transaction_id
      );
    END IF;
  END IF;

  UPDATE tolovlar
  SET ai_confidence = v_confidence,
      ai_extracted_amount = p_ai_extracted_amount,
      ai_analysis = v_analysis,
      transaction_id = v_transaction_id
  WHERE id = p_payment_id AND status = 'waiting';

  RETURN QUERY SELECT true, v_is_conflict, v_confidence, v_analysis, v_transaction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_payment_analysis(uuid, text, text, text, int, int, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_payment_analysis(uuid, text, text, text, int, int, text) TO service_role;
