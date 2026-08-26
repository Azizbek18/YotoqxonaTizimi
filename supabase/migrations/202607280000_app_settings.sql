-- Replaces the admin Settings page's fake, unpersisted toggles
-- (maintenance mode / 2FA / IP whitelist — none of which were wired to any
-- real feature) with a small set of values that actually were hardcoded
-- elsewhere in the app (monthly fee, contract fee, default room capacity,
-- floor count, staff contact numbers) and genuinely benefit from being
-- admin-editable.
--
-- Single-row table (id is always 1) — a simple typed row is enough for this
-- small, fixed set of values; no need for a generic key-value config store.
-- Uses ADD COLUMN IF NOT EXISTS per-column rather than one CREATE TABLE
-- block: this migration went through several rounds of schema changes
-- before ever being applied to a real database, so an environment that
-- ran an earlier draft only has a subset of these columns — a plain
-- `CREATE TABLE IF NOT EXISTS` would then silently no-op and leave the
-- newer columns missing entirely.
CREATE TABLE IF NOT EXISTS app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1)
);
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS monthly_fee numeric NOT NULL DEFAULT 300000;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS yearly_contract_fee numeric NOT NULL DEFAULT 3000000;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS default_room_capacity int NOT NULL DEFAULT 4;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS floor_count int NOT NULL DEFAULT 5;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS tarbiyachi_name text NOT NULL DEFAULT '';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS tarbiyachi_phone text NOT NULL DEFAULT '';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS komendant_name text NOT NULL DEFAULT '';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS komendant_phone text NOT NULL DEFAULT '';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS doctor_name text NOT NULL DEFAULT '';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS doctor_phone text NOT NULL DEFAULT '';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS talaba_kengashi_raisi_ogil_name text NOT NULL DEFAULT '';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS talaba_kengashi_raisi_ogil_phone text NOT NULL DEFAULT '';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS talaba_kengashi_raisi_qiz_name text NOT NULL DEFAULT '';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS talaba_kengashi_raisi_qiz_phone text NOT NULL DEFAULT '';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS security_phone text NOT NULL DEFAULT '';
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS max_upload_size_mb int NOT NULL DEFAULT 5;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS warning_threshold int NOT NULL DEFAULT 2;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_monthly_fee_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_monthly_fee_check CHECK (monthly_fee >= 0);
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_yearly_contract_fee_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_yearly_contract_fee_check CHECK (yearly_contract_fee >= 0);
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_default_room_capacity_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_default_room_capacity_check CHECK (default_room_capacity > 0);
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_floor_count_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_floor_count_check CHECK (floor_count > 0);
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_max_upload_size_mb_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_max_upload_size_mb_check CHECK (max_upload_size_mb > 0);
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_warning_threshold_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_warning_threshold_check CHECK (warning_threshold > 0);

-- Seed the single row with today's previously-hardcoded values so nothing
-- changes for end users until an admin actually edits something.
INSERT INTO app_settings (
  id, monthly_fee, yearly_contract_fee, default_room_capacity, floor_count,
  tarbiyachi_name, tarbiyachi_phone, komendant_name, komendant_phone,
  doctor_name, doctor_phone,
  talaba_kengashi_raisi_ogil_name, talaba_kengashi_raisi_ogil_phone,
  talaba_kengashi_raisi_qiz_name, talaba_kengashi_raisi_qiz_phone,
  security_phone, max_upload_size_mb, warning_threshold
) VALUES (
  1, 300000, 3000000, 4, 5,
  'Mo''minov Azizbek', '+998909998877', 'Qodirov Sardor', '+998931112233',
  'Sultonova Ra''no', '+998944445566',
  '', '', '', '',
  '+998712000000', 5, 2
) ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- No client-facing policies: only the service-role key (via
-- /api/settings for reads, /api/dekan/settings for dekan writes) touches
-- this table, matching how floor_room_layout is handled elsewhere in this
-- schema.
