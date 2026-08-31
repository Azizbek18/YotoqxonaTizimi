-- One-time Telegram deep links for permit status notifications.
-- Raw tokens are never stored: only their SHA-256 hashes reach the database.
CREATE TABLE IF NOT EXISTS public.permit_telegram_links (
  permit_request_id uuid PRIMARY KEY
    REFERENCES public.permit_requests(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_expires_at timestamptz NOT NULL,
  chat_id bigint,
  linked_at timestamptz,
  last_notified_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT permit_telegram_token_hash_format
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT permit_telegram_status_value
    CHECK (last_notified_status IS NULL OR last_notified_status IN ('pending', 'approved', 'rejected', 'registered')),
  CONSTRAINT permit_telegram_link_pair
    CHECK ((chat_id IS NULL AND linked_at IS NULL) OR (chat_id IS NOT NULL AND linked_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS permit_telegram_links_chat_id_idx
  ON public.permit_telegram_links(chat_id)
  WHERE chat_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS permit_telegram_links_expiry_idx
  ON public.permit_telegram_links(token_expires_at)
  WHERE chat_id IS NULL;

ALTER TABLE public.permit_telegram_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.permit_telegram_links FROM anon, authenticated;

COMMENT ON TABLE public.permit_telegram_links IS
  'Server-only mapping between one permit request and the Telegram chat that receives its status.';
