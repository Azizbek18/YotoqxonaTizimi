-- "Connected devices" — a user sees and revokes their own auth.sessions
-- (Supabase does not expose the auth schema to PostgREST). SECURITY DEFINER,
-- callable only by the app's service role; every function is keyed to
-- p_user_id so a route can only ever act on the authenticated caller.

CREATE OR REPLACE FUNCTION public.list_user_sessions(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  created_at timestamptz,
  refreshed_at timestamptz,
  user_agent text,
  ip text,
  not_after timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT s.id,
         s.created_at,
         s.refreshed_at::timestamptz,
         s.user_agent,
         host(s.ip),
         s.not_after
  FROM auth.sessions s
  WHERE s.user_id = p_user_id
    AND (s.not_after IS NULL OR s.not_after > now())
  ORDER BY COALESCE(s.refreshed_at::timestamptz, s.created_at) DESC
$$;

CREATE OR REPLACE FUNCTION public.revoke_user_session(p_user_id uuid, p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  DELETE FROM auth.sessions WHERE id = p_session_id AND user_id = p_user_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_other_user_sessions(p_user_id uuid, p_keep_session_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE n integer;
BEGIN
  DELETE FROM auth.sessions
  WHERE user_id = p_user_id
    AND (p_keep_session_id IS NULL OR id <> p_keep_session_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.list_user_sessions(uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.revoke_user_session(uuid, uuid) FROM anon, authenticated, public;
REVOKE ALL ON FUNCTION public.revoke_other_user_sessions(uuid, uuid) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.list_user_sessions(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_user_session(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_other_user_sessions(uuid, uuid) TO service_role;
