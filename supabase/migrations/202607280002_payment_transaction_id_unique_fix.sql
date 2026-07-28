-- 202607280001 added a UNIQUE index on tolovlar.transaction_id_normalized,
-- assuming only one row per receipt upload ever carries a transaction_id.
-- That's true going forward (the AI analysis route is only ever triggered
-- for the first row of a batch — see app/talaba/tolova/page.tsx and
-- app/admin/tolovlar/page.tsx, both of which analyze records[0]/
-- insertedDatas[0] and nothing else), but a multi-month receipt is split
-- across several `tolovlar` rows, and before that "one call per batch"
-- behavior existed, every row in a batch could independently get analyzed
-- and end up with the exact same transaction_id. Any such historical rows
-- would make `CREATE UNIQUE INDEX` fail outright over existing data.
--
-- Clean that up first — keep the transaction_id on the earliest row of
-- each (receipt_hash, transaction_id_normalized) group, clear it from the
-- rest — so the index can be (re)created safely regardless of whether
-- 202607280001 already ran, partially ran, or never ran.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY receipt_hash, transaction_id_normalized
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM tolovlar
  WHERE transaction_id_normalized <> '' AND receipt_hash IS NOT NULL
)
UPDATE tolovlar
SET transaction_id = NULL
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

DROP INDEX IF EXISTS tolovlar_transaction_id_normalized_idx;
DROP INDEX IF EXISTS tolovlar_transaction_id_normalized_unique_idx;

CREATE UNIQUE INDEX tolovlar_transaction_id_normalized_unique_idx
  ON tolovlar(transaction_id_normalized) WHERE transaction_id_normalized <> '';
