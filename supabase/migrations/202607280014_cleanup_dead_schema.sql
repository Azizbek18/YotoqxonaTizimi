-- Cleanup pass over schema drift/dead objects found while reconciling the
-- full migration history against the live database for the first time
-- (see 202607280013's comment for background on that drift).

-- 1. users."phoneNumber" is a stray camelCase duplicate of phone_number
-- that predates this repo's migrations and that no application code reads
-- or writes (the app only ever uses phone_number). Critically, for most
-- rows the *real* phone number only ever ended up in this column —
-- phone_number itself is NULL for them, making those users' phone numbers
-- invisible to the app. Backfill before dropping the column, or that data
-- is lost permanently.
--
-- Guarded by a column-existence check: "phoneNumber" only exists on the
-- one live database this drift was found on, from schema history outside
-- this repo's migrations — a database built purely from this migration
-- history from scratch never has it, and the bare UPDATE below would fail
-- with "column phoneNumber does not exist" on a fresh install.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phoneNumber'
  ) THEN
    UPDATE users
    SET phone_number = "phoneNumber"
    WHERE phone_number IS NULL AND "phoneNumber" IS NOT NULL;

    ALTER TABLE users DROP COLUMN "phoneNumber";
  END IF;
END $$;

-- 2. staff.position / staff.work_start_date: same kind of stray columns,
-- but confirmed empty on every row (no data to lose) and referenced by no
-- application code.
ALTER TABLE staff DROP COLUMN IF EXISTS position;
ALTER TABLE staff DROP COLUMN IF EXISTS work_start_date;

-- 3. admin_invites / staff_invites: legacy tables from an invite-based
-- staff registration flow that was replaced by the link-key + register-
-- code flow in lib/staff-access.ts. No application code queries either
-- table anymore. staff_invites is empty; admin_invites holds a single
-- never-used, unexpired invite row with no functional purpose once the
-- table itself is unreachable from the app.
DROP TABLE IF EXISTS admin_invites CASCADE;
DROP TABLE IF EXISTS staff_invites CASCADE;
