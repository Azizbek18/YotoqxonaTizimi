-- The student's hand-drawn signature (PNG data URL) captured on a canvas
-- and embedded into the generated PDF. Part of the append-only signature
-- row; its sha256 is folded into content_hash so tampering is detectable.
ALTER TABLE public.ariza_signatures
  ADD COLUMN IF NOT EXISTS signature_image text;
