-- CRITICAL: found live on production during a follow-up RLS audit. Four
-- storage.objects policies named "Azizbek 1bs1gex_0" through "_3" (the
-- auto-generated naming Supabase's dashboard Storage UI uses) granted the
-- fully unauthenticated `anon` role SELECT/INSERT/UPDATE/DELETE on the
-- entire 'avatar' bucket, scoped only by bucket_id — no path or ownership
-- check at all. Anyone with just the project's anon key, no login
-- whatsoever, could upload arbitrary files into the bucket, overwrite any
-- existing user's avatar, or delete every avatar in it. Since the bucket
-- is also publicly readable (intentionally — see "Avatar images are
-- publicly accessible"), anything uploaded this way would be served
-- publicly from this app's own storage domain too.
--
-- These policies appear nowhere in this repo's migration history — same
-- class of undocumented drift as 202607280018's "anyone_can_read_users",
-- created some other way outside of what these files ever tracked.
--
-- The real upload/delete path (app/api/student/profile/upload-avatar)
-- already uses the service-role client, which bypasses RLS entirely, so
-- these anon-facing policies serve no purpose for the app itself. Drop all
-- four; "Avatar images are publicly accessible" (SELECT only) remains as
-- the sole, intentional public-read policy for this bucket.
DROP POLICY IF EXISTS "Azizbek 1bs1gex_0" ON storage.objects;
DROP POLICY IF EXISTS "Azizbek 1bs1gex_1" ON storage.objects;
DROP POLICY IF EXISTS "Azizbek 1bs1gex_2" ON storage.objects;
DROP POLICY IF EXISTS "Azizbek 1bs1gex_3" ON storage.objects;
