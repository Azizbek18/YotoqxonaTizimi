-- Browser/Web Push subscriptions. The browser never talks to this table
-- directly; authenticated and permit-bound API routes validate ownership,
-- then use the server-side service key.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  permit_request_id uuid REFERENCES public.permit_requests(id) ON DELETE CASCADE,
  expiration_time bigint,
  user_agent text,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_owner_check
    CHECK (user_id IS NOT NULL OR permit_request_id IS NOT NULL),
  CONSTRAINT push_subscriptions_endpoint_length_check
    CHECK (char_length(endpoint) BETWEEN 20 AND 4096),
  CONSTRAINT push_subscriptions_key_length_check
    CHECK (char_length(p256dh) BETWEEN 20 AND 512 AND char_length(auth) BETWEEN 8 AND 256)
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_enabled_idx
  ON public.push_subscriptions (user_id)
  WHERE enabled = true AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS push_subscriptions_permit_enabled_idx
  ON public.push_subscriptions (permit_request_id)
  WHERE enabled = true AND permit_request_id IS NOT NULL;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.push_subscriptions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.push_subscriptions TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.push_subscriptions_id_seq TO service_role;

COMMENT ON TABLE public.push_subscriptions IS
  'Server-managed Web Push endpoints bound to one authenticated student or one verified permit request.';
