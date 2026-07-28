-- 202607280001's UNIQUE index on tolovlar.transaction_id_normalized enforces
-- uniqueness per monthly-row, but a single multi-month receipt upload is
-- split across several `tolovlar` rows that all share the same
-- receipt_hash/receipt_url (see features/payments/server/service.ts). The
-- app only ever triggers /api/ai/tahlil for the first row of a batch by
-- convention, but the route itself lets the owner (or an admin) analyze
-- ANY row directly by id — analyzing a second row of the SAME batch
-- downloads the same file, the AI extracts the same transaction_id, and
-- the UPDATE on that row then collides with the first row's already-set
-- transaction_id under the per-row UNIQUE index — falsely flagging a
-- legitimate same-batch receipt as a duplicate/fraud.
--
-- Move the actual uniqueness enforcement to receipt_hash granularity: one
-- row per physical receipt file, so re-analyzing any row of the same batch
-- upserts the same receipt_hash row (no conflict), while a genuinely
-- different receipt claiming an already-used transaction_id still hits the
-- UNIQUE constraint on transaction_id_normalized.
CREATE TABLE IF NOT EXISTS payment_receipt_transactions (
  receipt_hash text PRIMARY KEY,
  transaction_id text,
  transaction_id_normalized text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill from existing tolovlar rows so historical transaction ids stay
-- covered by the new atomic check, not just the (non-atomic) soft lookup —
-- one row per receipt_hash, picking the earliest tolovlar row per receipt
-- in case a batch already has the transaction_id duplicated across its rows.
INSERT INTO payment_receipt_transactions (receipt_hash, transaction_id, transaction_id_normalized)
SELECT DISTINCT ON (receipt_hash) receipt_hash, transaction_id, transaction_id_normalized
FROM tolovlar
WHERE receipt_hash IS NOT NULL AND transaction_id_normalized <> ''
ORDER BY receipt_hash, created_at ASC, id ASC
ON CONFLICT (receipt_hash) DO NOTHING;

CREATE UNIQUE INDEX IF NOT EXISTS payment_receipt_transactions_txid_unique_idx
  ON payment_receipt_transactions (transaction_id_normalized) WHERE transaction_id_normalized <> '';

ALTER TABLE payment_receipt_transactions ENABLE ROW LEVEL SECURITY;
-- No client-facing policies: only /api/ai/tahlil (service-role client)
-- touches this table.

-- The per-row constraint on tolovlar is no longer the source of truth —
-- replace it with a plain (non-unique) index so the existing soft
-- duplicate-check lookup in /api/ai/tahlil stays fast.
DROP INDEX IF EXISTS tolovlar_transaction_id_normalized_unique_idx;
CREATE INDEX IF NOT EXISTS tolovlar_transaction_id_normalized_idx
  ON tolovlar(transaction_id_normalized) WHERE transaction_id_normalized <> '';
