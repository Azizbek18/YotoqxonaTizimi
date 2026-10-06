-- In a blocked dorm (A/B) two captains can share a floor number and gender, one
-- per block. Sessions were keyed on (dorm, date, kind, gender, floor) only, so
-- both captains were handed the same session and one closing it closed it for
-- the other. Add the block to the session scope and to its dedupe index.
-- Existing rows keep block NULL (dorm-wide), which still matches every captain.
ALTER TABLE public.attendance_sessions ADD COLUMN IF NOT EXISTS block text;

DROP INDEX IF EXISTS public.attendance_sessions_nightly_key;
CREATE UNIQUE INDEX attendance_sessions_nightly_key ON public.attendance_sessions
  (dorm_id, scheduled_for, kind, COALESCE(gender, ''), COALESCE(floor_number, -1), COALESCE(block, ''))
  WHERE kind <> 'dekan';
