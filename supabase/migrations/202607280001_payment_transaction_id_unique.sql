-- The AI receipt-analysis route (/api/ai/tahlil) previously detected
-- duplicate transaction IDs with a "SELECT, then decide" check against the
-- raw (non-normalized) transaction_id column. That's both bypassable
-- (submitting the same transaction id in a different format, e.g.
-- "TX-778812340" vs "tx778812340", didn't match) and racy (two concurrent
-- analyses of the same transaction id could both pass the check before
-- either write lands). Replacing the plain index with a UNIQUE one makes
-- the database itself the atomic source of truth: a second write for the
-- same normalized transaction id now fails with a 23505 conflict instead
-- of silently succeeding.
--
-- Before this ever ran against a real database, the AI analysis route
-- didn't restrict itself to "one call per batch" — every row in a
-- multi-month receipt's batch could independently get analyzed and end up
-- with the exact same transaction_id. Any such historical duplicate rows
-- would make CREATE UNIQUE INDEX fail outright, and — since a failed
-- statement aborts the whole migration run — this migration would never
-- succeed and every migration after it (including any later cleanup) would
-- never even be attempted. So the dedup has to happen in THIS migration,
-- before the index is created, not in a follow-up one.
--
-- The index below is GLOBAL on transaction_id_normalized (not scoped to
-- receipt_hash), so the dedup must match that scope exactly: partition by
-- transaction_id_normalized alone, across the whole table, including rows
-- where receipt_hash happens to be NULL (legacy rows predating that
-- column). Scoping the partition to (receipt_hash, transaction_id_normalized)
-- would leave two different receipts that happen to share a transaction id
-- undeduped, and CREATE UNIQUE INDEX would still fail on them.
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

CREATE UNIQUE INDEX IF NOT EXISTS tolovlar_transaction_id_normalized_unique_idx
  ON tolovlar(transaction_id_normalized) WHERE transaction_id_normalized <> '';
