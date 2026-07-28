-- monthly_fee and yearly_contract_fee were independently validated (each a
-- positive whole so'm) but never checked against each other. An admin could
-- save monthly=300000 / yearly=1000000: the payment submission endpoint
-- requires monthlyFee * months exactly, while the student dashboard shows
-- progress as paidAmount / yearlyContractFee — with an inconsistent pair,
-- those two disagree about what "fully paid" means (e.g. one month paid
-- would show 30% done against a contract that isn't actually 3.33 months
-- long). Enforce yearly_contract_fee as an exact whole multiple of
-- monthly_fee so the two stay mutually consistent.
--
-- Normalize the existing single row first, in case it already holds a
-- non-multiple pair — round up to the nearest whole multiple of
-- monthly_fee (never down, so the contract total never shrinks).
UPDATE app_settings
SET yearly_contract_fee = monthly_fee * CEIL(yearly_contract_fee / monthly_fee)
WHERE monthly_fee > 0 AND yearly_contract_fee % monthly_fee <> 0;

ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_fee_multiple_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_fee_multiple_check
  CHECK (yearly_contract_fee % monthly_fee = 0);
