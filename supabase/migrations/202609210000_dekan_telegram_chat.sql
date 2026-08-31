-- Per-faculty Telegram chat that gets a heads-up when a new yo'llanma /
-- imtiyozli ariza arrives. Empty by default; the dekan fills it from
-- /dekan/sozlamalar after adding the bot to that group. Lives on
-- app_settings because that table is already keyed by faculty — this value
-- is the dekan's, never the building's, so it does not belong in `dorms`.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS dekan_telegram_chat_id text;

-- Numeric chat id (groups are negative, e.g. -1001234567890) or an
-- @public_channel handle. NULL / absent = notifications off for the faculty.
ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_dekan_telegram_chat_id_format;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_dekan_telegram_chat_id_format
  CHECK (
    dekan_telegram_chat_id IS NULL
    OR dekan_telegram_chat_id ~ '^(-?[0-9]{1,20}|@[A-Za-z][A-Za-z0-9_]{3,31})$'
  );

COMMENT ON COLUMN public.app_settings.dekan_telegram_chat_id IS
  'Telegram chat id/handle notified on each new permit request for this faculty (server-only).';
