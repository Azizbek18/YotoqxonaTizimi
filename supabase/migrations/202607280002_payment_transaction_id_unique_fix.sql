-- 202607280001 now does this same dedup itself, before creating the unique
-- index (a failed CREATE UNIQUE INDEX there would otherwise abort the
-- migration run and permanently block this file from ever being reached).
-- This is kept as a harmless, idempotent defense-in-depth pass — re-running
-- the same dedup + DROP/CREATE INDEX here is a no-op once 001 has already
-- succeeded, but guards against any environment that somehow already had
-- 202607280001 applied in an older, pre-dedup form.
-- Partitioned by transaction_id_normalized alone (not receipt_hash) and not
-- filtered by receipt_hash IS NOT NULL — matches the global scope of the
-- unique index below (see 202607280001 for why: a narrower partition would
-- leave two different receipts sharing a transaction id undeduped).
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY transaction_id_normalized
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM tolovlar
  WHERE transaction_id_normalized <> ''
)
UPDATE tolovlar
SET transaction_id = NULL
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

DROP INDEX IF EXISTS tolovlar_transaction_id_normalized_idx;
DROP INDEX IF EXISTS tolovlar_transaction_id_normalized_unique_idx;

CREATE UNIQUE INDEX tolovlar_transaction_id_normalized_unique_idx
  ON tolovlar(transaction_id_normalized) WHERE transaction_id_normalized <> '';
