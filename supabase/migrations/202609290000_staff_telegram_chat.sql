-- A staff member's PERSONAL Telegram chat — distinct from the per-faculty
-- app_settings.dekan_telegram_chat_id (which is the permit-notification
-- group). A tarbiyachi sets this from /tarbiyachi/sozlamalar to be pinged
-- when a student in their dorm files a new ariza / tushuntirish. Empty by
-- default; a dekan/admin may set one too.
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- Numeric chat id (a personal chat is positive, groups are negative) or an
-- @public_channel handle. NULL / absent = no personal notifications.
ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_telegram_chat_id_format;
ALTER TABLE public.staff
  ADD CONSTRAINT staff_telegram_chat_id_format
  CHECK (
    telegram_chat_id IS NULL
    OR telegram_chat_id ~ '^(-?[0-9]{1,20}|@[A-Za-z][A-Za-z0-9_]{3,31})$'
  );

COMMENT ON COLUMN public.staff.telegram_chat_id IS
  'Personal Telegram chat id/handle for this staff member''s own notifications (server-only).';
