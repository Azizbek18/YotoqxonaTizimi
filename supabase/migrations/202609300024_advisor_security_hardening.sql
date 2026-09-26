-- Supabase security advisor clean-up (2026-09-26).
--
-- 1. function_search_path_mutable: pin search_path on the two trigger
--    functions so a role with CREATE on some schema can't shadow the
--    objects they reference.
-- 2. authenticated_security_definer_function_executable: is_admin /
--    is_active_staff_role were kept executable by `authenticated` (see
--    202607280020) because RLS policies called them. No policy references
--    them any more (every table is deny-all; the app goes through the
--    service role), so the grant is now only an oracle: any signed-in user
--    could call /rest/v1/rpc/is_admin with an arbitrary uuid and learn
--    whether that account is a superadmin.

ALTER FUNCTION public.enforce_dorm_id_when_roomed() SET search_path = public, pg_temp;
ALTER FUNCTION public.ariza_signatures_no_update() SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_active_staff_role(text[]) FROM PUBLIC, anon, authenticated;
