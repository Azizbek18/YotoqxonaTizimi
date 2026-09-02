-- Lets a registered student link their Telegram chat so document receipts
-- (signed arizalar, etc.) can be delivered to the bot. Mirrors
-- permit_telegram_links: raw tokens are never stored, only SHA-256 hashes.
CREATE TABLE IF NOT EXISTS public.student_telegram_links (
  student_id        uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash        text NOT NULL UNIQUE,
  token_expires_at  timestamptz NOT NULL,
  chat_id           bigint,
  linked_at         timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_telegram_token_hash_format CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT student_telegram_link_state
    CHECK ((chat_id IS NULL AND linked_at IS NULL) OR (chat_id IS NOT NULL AND linked_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS student_telegram_links_chat_id_idx
  ON public.student_telegram_links(chat_id) WHERE chat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS student_telegram_links_expiry_idx
  ON public.student_telegram_links(token_expires_at) WHERE chat_id IS NULL;

ALTER TABLE public.student_telegram_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_telegram_links FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.student_telegram_links FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_telegram_links TO service_role;

COMMENT ON TABLE public.student_telegram_links IS
  'Per-student Telegram chat binding for document delivery. Token-based /start deep link, hashes only.';
