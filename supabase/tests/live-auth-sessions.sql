-- Run as postgres after require_live_auth_sessions. All fixture data is
-- rolled back. No real account, session, or notification is touched.
BEGIN;

DO $$
DECLARE
  v_user uuid := gen_random_uuid();
  v_other_user uuid := gen_random_uuid();
  v_session uuid := gen_random_uuid();
  v_second_session uuid := gen_random_uuid();
  v_expired_session uuid := gen_random_uuid();
  v_count integer;
BEGIN
  INSERT INTO auth.users (id, email)
  VALUES (v_user, v_user::text || '@session-test.invalid'),
         (v_other_user, v_other_user::text || '@session-test.invalid');
  INSERT INTO auth.sessions (id, user_id, created_at, not_after)
  VALUES (v_session, v_user, now(), NULL),
         (v_second_session, v_user, now(), now() + interval '1 hour'),
         (v_expired_session, v_user, now(), now() - interval '1 minute');
  INSERT INTO public.staff (id, email, full_name, role, status)
  VALUES (v_user, v_user::text || '@session-test.invalid', 'Session test fixture', 'admin', 'active'),
         (v_other_user, v_other_user::text || '@session-test.invalid', 'Other session test fixture', 'admin', 'active');

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_user, 'session_id', v_session, 'role', 'authenticated'
  )::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF NOT private.has_active_auth_session() THEN
    RAISE EXCEPTION 'Active session must be accepted';
  END IF;
  SELECT count(*) INTO v_count FROM public.staff WHERE id IN (v_user, v_other_user);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Active caller must see only their own staff row';
  END IF;
  EXECUTE 'RESET ROLE';

  IF NOT public.revoke_user_session(v_user, v_session) THEN
    RAISE EXCEPTION 'Fixture session was not revoked';
  END IF;
  IF EXISTS (SELECT 1 FROM public.list_user_sessions(v_user) WHERE id = v_session) THEN
    RAISE EXCEPTION 'Revoked session must disappear from the API session lookup';
  END IF;
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF private.has_active_auth_session() THEN
    RAISE EXCEPTION 'Unchanged JWT claims must be rejected after revocation';
  END IF;
  SELECT count(*) INTO v_count FROM public.staff WHERE id = v_user;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Revoked JWT must not read its own row through the Data API';
  END IF;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_user, 'session_id', v_second_session, 'role', 'authenticated'
  )::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF NOT private.has_active_auth_session() THEN
    RAISE EXCEPTION 'Revoking one device must not revoke another';
  END IF;
  EXECUTE 'RESET ROLE';

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_other_user, 'session_id', v_second_session, 'role', 'authenticated'
  )::text, true);
  IF private.has_active_auth_session() THEN
    RAISE EXCEPTION 'A session belonging to another user must be rejected';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_user, 'session_id', v_expired_session, 'role', 'authenticated'
  )::text, true);
  IF private.has_active_auth_session() THEN
    RAISE EXCEPTION 'Expired sessions must be rejected';
  END IF;
  IF EXISTS (SELECT 1 FROM public.list_user_sessions(v_user) WHERE id = v_expired_session) THEN
    RAISE EXCEPTION 'Expired session must not be returned to the API';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user)::text, true);
  IF private.has_active_auth_session() THEN
    RAISE EXCEPTION 'Missing session_id must fail closed';
  END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object(
    'sub', v_user, 'session_id', 'not-a-uuid'
  )::text, true);
  IF private.has_active_auth_session() THEN
    RAISE EXCEPTION 'Malformed session_id must fail closed';
  END IF;
  PERFORM set_config('request.jwt.claims', '{}'::text, true);
  IF private.has_active_auth_session() THEN
    RAISE EXCEPTION 'Missing identity must fail closed';
  END IF;

  IF has_function_privilege('anon', 'private.has_active_auth_session()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous callers must not execute the private helper';
  END IF;
  SELECT count(*) INTO v_count FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('users', 'staff', 'arizalar', 'tolovlar')
    AND policyname = 'Require live auth session'
    AND permissive = 'RESTRICTIVE'
    AND qual LIKE '%private.has_active_auth_session()%'
    AND with_check LIKE '%private.has_active_auth_session()%';
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'All four client-readable tables must enforce live sessions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Require live auth session for private files'
      AND permissive = 'RESTRICTIVE'
  ) THEN
    RAISE EXCEPTION 'Private storage must enforce live sessions';
  END IF;
END;
$$;

ROLLBACK;
