-- Elektron imzo — talaba arizalari (arizalar.type in 'ariza','tushuntirish').
--
-- Non-repudiation record: the frozen content the student attested to, its
-- sha256 hash, an HMAC signature only the server can produce, and the
-- evidence around the act (typed name, time, IP, device). Append-only — a
-- BEFORE UPDATE trigger locks every row the moment it is written.

CREATE TABLE IF NOT EXISTS public.ariza_signatures (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ariza_id         uuid NOT NULL UNIQUE REFERENCES public.arizalar(id) ON DELETE CASCADE,
  student_id       uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_hash     text NOT NULL,
  content_snapshot jsonb NOT NULL,
  typed_name       text NOT NULL,
  signed_at        timestamptz NOT NULL DEFAULT now(),
  client_ip        text,
  user_agent       text,
  verify_code      text NOT NULL UNIQUE,
  signature        text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ariza_signatures_student_idx
  ON public.ariza_signatures (student_id, signed_at DESC);

-- Append-only. Once signed, the row never changes; tampering with the
-- snapshot or the hash is already detectable via the hash / HMAC, this just
-- refuses the write outright. DELETE is allowed only so ON DELETE CASCADE
-- from arizalar still works.
CREATE OR REPLACE FUNCTION public.ariza_signatures_no_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ariza_signatures is append-only';
END;
$$;

DROP TRIGGER IF EXISTS ariza_signatures_lock ON public.ariza_signatures;
CREATE TRIGGER ariza_signatures_lock
  BEFORE UPDATE ON public.ariza_signatures
  FOR EACH ROW EXECUTE FUNCTION public.ariza_signatures_no_update();

ALTER TABLE public.ariza_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ariza_signatures FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ariza_signatures FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.ariza_signatures TO service_role;
