-- 202607280013 was written to re-assert the "corrected end state" of
-- 202607280001-004 for any environment that had only run their older,
-- already-committed versions. But it recreated the UNIQUE index on
-- tolovlar.transaction_id_normalized — exactly what 202607280007 (which
-- runs BEFORE 013 in file order but represents a LATER design decision)
-- deliberately dropped in favor of receipt-hash-granularity enforcement
-- via payment_receipt_transactions. Since 013 runs after 007, it silently
-- undid that fix: analyzing the second row of a multi-month batch collides
-- with the first row's transaction_id under the reinstated per-row UNIQUE
-- index, falsely flagging a legitimate same-batch receipt as a duplicate.
--
-- Restore 007's actual end state: no unique constraint at the tolovlar
-- row level, just a plain index for the soft duplicate-check lookup.
DROP INDEX IF EXISTS tolovlar_transaction_id_normalized_unique_idx;
CREATE INDEX IF NOT EXISTS tolovlar_transaction_id_normalized_idx
  ON tolovlar(transaction_id_normalized) WHERE transaction_id_normalized <> '';
