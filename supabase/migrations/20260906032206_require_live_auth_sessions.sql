-- A signed access token outlives logout/revocation. Require its session to
-- exist for direct Data API / Storage reads as well as application API calls.
-- Keep the lookup out of exposed schemas and never accept a caller-supplied
-- user or session argument: both must come from the verified JWT.
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.has_active_auth_session()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_session_id text := auth.jwt() ->> 'session_id';
BEGIN
  IF v_user_id IS NULL
     OR v_session_id IS NULL
     OR v_session_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM auth.sessions s
    WHERE s.id = v_session_id::uuid
      AND s.user_id = v_user_id
      AND (s.not_after IS NULL OR s.not_after > now())
  );
END;
$$;

REVOKE ALL ON FUNCTION private.has_active_auth_session() FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_active_auth_session() TO authenticated;

-- RESTRICTIVE policies are ANDed with the existing ownership policies.
-- They cannot accidentally grant access to another user's rows, and the
-- SELECT wrapper evaluates the session check once per statement.
CREATE POLICY "Require live auth session"
ON public.users AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT private.has_active_auth_session()))
WITH CHECK ((SELECT private.has_active_auth_session()));

CREATE POLICY "Require live auth session"
ON public.staff AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT private.has_active_auth_session()))
WITH CHECK ((SELECT private.has_active_auth_session()));

CREATE POLICY "Require live auth session"
ON public.arizalar AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT private.has_active_auth_session()))
WITH CHECK ((SELECT private.has_active_auth_session()));

CREATE POLICY "Require live auth session"
ON public.tolovlar AS RESTRICTIVE FOR ALL TO authenticated
USING ((SELECT private.has_active_auth_session()))
WITH CHECK ((SELECT private.has_active_auth_session()));

-- Avatars are deliberately public. Every other bucket still needs its own
-- permissive policy, plus a live session for authenticated client access.
CREATE POLICY "Require live auth session for private files"
ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (bucket_id = 'avatar' OR (SELECT private.has_active_auth_session()))
WITH CHECK (bucket_id = 'avatar' OR (SELECT private.has_active_auth_session()));
