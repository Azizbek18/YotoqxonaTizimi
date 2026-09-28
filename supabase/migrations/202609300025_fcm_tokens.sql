-- FCM device tokens for the native Flutter student app. Mirrors
-- push_subscriptions' security posture (RLS forced, no policies,
-- service-role-only access — ownership is enforced in route code, never by
-- the client talking to this table directly). Login-only, student-only: no
-- permit-anchored binding like push_subscriptions has.
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fcm_tokens_token_length_check CHECK (char_length(token) BETWEEN 32 AND 4096)
);

CREATE INDEX IF NOT EXISTS fcm_tokens_user_enabled_idx
  ON public.fcm_tokens (user_id)
  WHERE enabled = true;

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_tokens FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.fcm_tokens FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fcm_tokens TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.fcm_tokens_id_seq TO service_role;

COMMENT ON TABLE public.fcm_tokens IS
  'Server-managed FCM device tokens for the native Flutter student app. No RLS policies — ownership enforced in route code.';
