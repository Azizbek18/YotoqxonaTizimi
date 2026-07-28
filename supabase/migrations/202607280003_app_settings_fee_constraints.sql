-- monthly_fee/yearly_contract_fee only had a `>= 0` check, so an admin
-- could save 0 or a fractional value (e.g. 300000.5) through direct DB
-- access. features/payments/server/service.ts requires the submitted
-- amount to be a positive safe integer equal to monthlyFee * months, so
-- either of those would make every payment submission fail. Tighten to a
-- positive whole so'm, matching the app-layer validation added alongside
-- this migration (features/app-settings/server/service.ts parseAmount).
--
-- Normalize the existing single row first — otherwise, if it already holds
-- a 0/fractional value from before this constraint (or app-layer
-- validation) existed, ADD CONSTRAINT would fail outright on that row.
UPDATE app_settings
SET monthly_fee = GREATEST(1, round(monthly_fee)),
    yearly_contract_fee = GREATEST(1, round(yearly_contract_fee));

ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_monthly_fee_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_monthly_fee_check
  CHECK (monthly_fee >= 1 AND monthly_fee = floor(monthly_fee));

ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_yearly_contract_fee_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_yearly_contract_fee_check
  CHECK (yearly_contract_fee >= 1 AND yearly_contract_fee = floor(yearly_contract_fee));
