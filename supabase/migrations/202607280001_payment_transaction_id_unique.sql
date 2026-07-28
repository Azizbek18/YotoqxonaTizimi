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
DROP INDEX IF EXISTS tolovlar_transaction_id_normalized_idx;

CREATE UNIQUE INDEX IF NOT EXISTS tolovlar_transaction_id_normalized_unique_idx
  ON tolovlar(transaction_id_normalized) WHERE transaction_id_normalized <> '';
