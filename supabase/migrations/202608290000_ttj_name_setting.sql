-- The Ariza/Tilxat documents (app/imtiyozli-ariza, and UzMU's official
-- template) reference the dormitory by its official number/name — "___
-- -sonli talabalar turar joyi". That's an institutional fact, not
-- per-application data, so it's a single dekan-configured setting rather
-- than something typed into every application. Left empty by default —
-- the dekan gets nagged (app/dekan/layout.tsx) until it's filled in,
-- rather than silently generating documents with a blank in them.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ttj_name text NOT NULL DEFAULT '';

COMMENT ON COLUMN public.app_settings.ttj_name IS
  'Official dormitory (TTJ) number/name — fills the "___-sonli talabalar turar joyi" blank in the imtiyozli Ariza/Tilxat documents.';
