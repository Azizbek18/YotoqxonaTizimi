-- ==========================================================
-- Stories: per-gender targeting for Kengash raisi
-- ==========================================================
-- dekan/tarbiyachi stories reach the whole faculty (target_gender NULL).
-- A talaba kengashi raisi only represents one gender's students across the
-- faculty (see requireCouncilChair / elonlar.target_gender) — without this
-- column their story would over-reach into the other gender's feed.

ALTER TABLE public.announcement_stories
  ADD COLUMN IF NOT EXISTS target_gender text CHECK (target_gender IN ('male', 'female'));

COMMENT ON COLUMN public.announcement_stories.target_gender IS
  'NULL = whole faculty (dekan/tarbiyachi); set = one gender only (kengash raisi), matches elonlar.target_gender.';

CREATE INDEX IF NOT EXISTS announcement_stories_gender_idx
  ON public.announcement_stories (faculty, target_gender, expires_at DESC);
