-- Structural fix, not a point fix: 202607280020 revoked anon/authenticated
-- EXECUTE from the functions that already had it, but the underlying cause
-- is this project's default privilege setup — `ALTER DEFAULT PRIVILEGES`
-- for role `postgres` (the role every migration in this repo runs as)
-- grants EXECUTE on every NEW function created in `public` directly to
-- anon and authenticated, automatically, at CREATE FUNCTION time. Every
-- SECURITY DEFINER function this project adds going forward would silently
-- get the same anon-callable hole unless someone remembers to revoke it
-- by hand every single time — exactly what happened repeatedly this
-- session (each function's own migration already ran a REVOKE ALL FROM
-- PUBLIC / GRANT TO service_role that turned out not to matter).
--
-- Change the default itself: new functions in `public` no longer grant
-- EXECUTE to anon/authenticated automatically. Functions that genuinely
-- need `authenticated` access (like is_admin/is_active_staff_role, called
-- from inside RLS policies) already have their own explicit GRANT and are
-- unaffected by this — this only changes what happens with no explicit
-- grant at all.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;

-- Also found live: a "cheklar" (Uzbek for "receipts") storage bucket,
-- public=true, that appears in no migration and that no application code
-- references (the real receipts bucket is "receipts", private — see
-- 202607260000). It's currently empty, so nothing is exposed today, but a
-- public bucket with an open-ended future is a standing risk for whatever
-- eventually lands in it by accident. Make it private like every other
-- bucket this app doesn't specifically serve publicly.
UPDATE storage.buckets SET public = false WHERE id = 'cheklar';
