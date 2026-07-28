-- CRITICAL: found live on production during a follow-up audit. Every
-- SECURITY DEFINER function in this schema — including
-- assign_student_room_atomic, approve_permit_room_atomic,
-- replace_floor_room_layout, promote_floor_captain, and
-- claim_receipt_transaction — had a direct EXECUTE grant to BOTH `anon`
-- and `authenticated`, despite each one's own migration already running
-- `REVOKE ALL ... FROM PUBLIC; GRANT EXECUTE ... TO service_role;`.
--
-- That revoke was ineffective: Supabase's project-level default privileges
-- grant EXECUTE on every newly created function directly to anon/
-- authenticated/service_role at CREATE FUNCTION time — a separate grant
-- from the implicit "PUBLIC" grant Postgres also adds, and REVOKE ALL
-- FROM PUBLIC does not touch it. The result: anyone with just this
-- project's public anon key — no login at all — could call
-- .../rest/v1/rpc/assign_student_room_atomic (or any of the others)
-- directly, since none of these functions check the caller's own identity
-- or role internally; they were only ever "protected" by the (broken)
-- assumption that just service_role could reach them. That let an
-- unauthenticated caller move any student into any room, approve any
-- permit request into any room, wipe/replace any floor's layout, or
-- promote/demote any floor captain — completely bypassing every
-- authorization check the Next.js API routes perform before calling these
-- same functions themselves via the service-role client.
--
-- Explicitly revoke anon + authenticated from every function that only
-- the app's own service-role-backed Route Handlers should ever call.
-- is_admin / is_active_staff_role are the exception: they're evaluated
-- *inside* RLS policies that apply to `authenticated`, so authenticated
-- must keep EXECUTE on those two specifically, or every one of those
-- policies breaks for legitimate signed-in users. anon has no legitimate
-- reason to call any function here directly.
REVOKE EXECUTE ON FUNCTION public.assign_student_room_atomic(uuid, text, int) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_permit_room_atomic(uuid, text, int) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.replace_floor_room_layout(int, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_floor_captain(uuid, int, text, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_receipt_transaction(text, text, text) FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_staff_role(text[]) FROM anon;

-- Trigger functions are never meant to be called directly (they reference
-- NEW/OLD, which only exist in trigger context) — the trigger mechanism
-- itself doesn't depend on the modifying role's EXECUTE grant on these, so
-- revoking direct-call access from anon/authenticated doesn't affect the
-- triggers firing normally.
REVOKE EXECUTE ON FUNCTION public.check_student_permit_approved() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_application_moderation_fields() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_elonlar_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_warning_count() FROM anon, authenticated;
