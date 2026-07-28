-- 202607280001, 202607280002, 202607280003 and 202607280004 were all
-- already committed once (in a previous commit) before being edited again
-- in this pass to fix scoping bugs in their dedup logic (see each file's
-- own comments). Supabase tracks applied migrations by filename/version,
-- not content — so if any environment already ran the OLDER committed
-- version of one of those files, editing it further does nothing there;
-- it's already marked applied and will never be re-executed.
--
-- Rather than assume no environment has run them yet, re-apply the
-- corrected end state here, in a new migration that always runs regardless
-- of which version of 001-004 (if any) already executed anywhere. Every
-- statement below is the same idempotent logic those files now contain.

-- 1. tolovlar.transaction_id_normalized: NOTE — this migration originally
-- recreated a UNIQUE index here to match 001/002's pre-007 design. That was
-- wrong: 202607280007 (which runs before this file, chronologically, but
-- represents a later design decision) deliberately replaced row-level
-- uniqueness with receipt-hash-level enforcement via
-- payment_receipt_transactions, specifically because a per-row UNIQUE
-- index falsely flags the second row of a legitimate multi-month batch as
-- a duplicate. Re-asserting a plain (non-unique) index here — see
-- 202607280015 for the migration that corrects this on any environment
-- that already ran the old version of this file.
DROP INDEX IF EXISTS tolovlar_transaction_id_normalized_unique_idx;
CREATE INDEX IF NOT EXISTS tolovlar_transaction_id_normalized_idx
  ON tolovlar(transaction_id_normalized) WHERE transaction_id_normalized <> '';

-- 2. app_settings fee columns: normalize then re-assert whole-positive
-- constraints (this table always has exactly one row, so this is cheap).
UPDATE app_settings
SET monthly_fee = GREATEST(1, round(monthly_fee)),
    yearly_contract_fee = GREATEST(1, round(yearly_contract_fee));

ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_monthly_fee_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_monthly_fee_check
  CHECK (monthly_fee >= 1 AND monthly_fee = floor(monthly_fee));

ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_yearly_contract_fee_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_yearly_contract_fee_check
  CHECK (yearly_contract_fee >= 1 AND yearly_contract_fee = floor(yearly_contract_fee));

-- 3. users.is_floor_captain: dedup any pre-existing duplicate captains per
-- (assigned_floor, gender), then re-assert the unique index.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY assigned_floor, gender
           ORDER BY updated_at DESC, id DESC
         ) AS rn
  FROM users
  WHERE is_floor_captain = true
)
UPDATE users
SET is_floor_captain = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS users_floor_captain_unique_idx
  ON users (assigned_floor, gender) WHERE is_floor_captain = true;
