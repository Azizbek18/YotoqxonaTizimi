-- ============================================================
-- RLS verification — run against staging AND production
-- ============================================================
-- Read-only. Compare the output against the "expected state" table in the
-- Bosqich 5 migration runbook. Anything not listed there — especially a
-- policy on public.users / staff / permit_requests / tolovlar / arizalar
-- whose USING clause is not `auth.uid() = <owner column>` — is drift and
-- must be investigated before the migration (see 202607280018 for how a
-- `USING (true)` policy once reached production outside the migration files).

-- Shared-dorm tenancy (P0–P5, migrations 202609130000–202609160000):
--   dorms / faculty_dorm / dorm_floor — RLS ENABLED, 0 policies (service-role
--   only, same as app_settings / floor_room_layout / staff_invites). Their
--   anon/authenticated base grants match every other locked-down table; RLS
--   is the gate. All access is via /api/dekan/dorm, /api/dekan/room-layout,
--   /api/staff/* which run as service_role and scope in the service layer.
--   dorm_claim_floors / dorm_resolve_floor / dorm_withdraw_floors and the
--   four rewritten room RPCs: SET search_path = public, EXECUTE revoked from
--   anon/authenticated. Expect queries 2/4 below to show NO new policy and
--   NO new anon/authenticated-callable function.

-- 1. Every table in `public`: is RLS enabled? is it FORCED?
SELECT
  n.nspname                         AS schema,
  c.relname                         AS table,
  c.relrowsecurity                  AS rls_enabled,
  c.relforcerowsecurity             AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;

-- 2. Every policy in `public`: which role, which command, and the full
--    USING / WITH CHECK expressions. Scan the qual column for anything
--    broader than an own-row check.
SELECT
  tablename,
  policyname,
  cmd,
  roles,
  qual        AS using_expr,
  with_check  AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Table-level privileges granted to anon / authenticated. RLS only
--    filters rows a role is already allowed to touch — a table with no
--    base grant to these roles is unreachable from a browser regardless
--    of policy.
SELECT
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- 4. Functions in `public` callable by anon / authenticated. SECURITY
--    DEFINER functions here are an execution surface; each should be a
--    caller-identity helper (is_admin, is_active_staff_role) — never a
--    data accessor. Everything else must be service_role only.
SELECT
  p.proname                                             AS function,
  pg_get_function_identity_arguments(p.oid)              AS args,
  p.prosecdef                                            AS security_definer,
  array_agg(acl.grantee::regrole ORDER BY acl.grantee)   AS grantees
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
WHERE n.nspname = 'public'
  AND acl.privilege_type = 'EXECUTE'
  AND acl.grantee::regrole::text IN ('anon', 'authenticated', 'public')
GROUP BY p.proname, args, p.prosecdef
ORDER BY p.proname;

-- 5. Storage buckets that are public. Only buckets the app deliberately
--    serves unauthenticated (none, currently) should be here.
SELECT id, name, public FROM storage.buckets ORDER BY id;

-- 6. Default privileges for role postgres in `public` — 202607280021 set
--    functions to NOT auto-grant EXECUTE to anon/authenticated. Confirm it
--    stuck (defaclacl should not list anon=X/ or authenticated=X/ for the
--    'f' (function) object type).
SELECT
  d.defaclobjtype AS object_type,   -- 'r' table, 'f' function, 'S' sequence
  d.defaclacl     AS default_acl
FROM pg_default_acl d
JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE n.nspname = 'public';
