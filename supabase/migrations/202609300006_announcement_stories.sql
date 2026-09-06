-- ==========================================================
-- Yangiliklar lentasi (Instagram-style "Stories")
-- ==========================================================
-- A faculty-scoped, image-first news channel shown at the top of the student
-- dashboard. Distinct lifecycle from `elonlar`: one image per row, a hard
-- 24-hour TTL, and a Telegram + Web Push broadcast on publish.
--
-- Every read/write goes through service-role Route Handlers (see
-- app/api/stories + app/api/dekan/stories), so the table itself is
-- service_role-only, exactly like push_subscriptions / student_telegram_links.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.announcement_stories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL CHECK (char_length(trim(title)) BETWEEN 2 AND 120),
  caption     text CHECK (caption IS NULL OR char_length(caption) <= 500),
  type        text NOT NULL DEFAULT 'Yangilik'
              CHECK (type IN ('Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish')),
  image_path  text NOT NULL,          -- storage object path, used for cleanup on delete
  image_url   text NOT NULL,          -- public URL, used for render + Telegram photo
  link_url    text CHECK (link_url IS NULL OR link_url ~ '^https?://'),
  faculty     text NOT NULL,          -- staff.faculty, stored trim + lowercase
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

-- The student query is "active stories for my faculty, newest first".
CREATE INDEX IF NOT EXISTS announcement_stories_active_idx
  ON public.announcement_stories (faculty, expires_at DESC);

ALTER TABLE public.announcement_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_stories FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.announcement_stories FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.announcement_stories TO service_role;

COMMENT ON TABLE public.announcement_stories IS
  'Faculty-scoped image "stories" for the student dashboard. 24h TTL, service-role only, broadcast on publish.';

-- ----------------------------------------------------------
-- Storage: a public bucket for the story images (mirrors `avatar`).
-- ----------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('stories', 'stories', true, 4194304, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Story images are publicly accessible" ON storage.objects;
CREATE POLICY "Story images are publicly accessible"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'stories');

-- The RESTRICTIVE "live auth session" gate (20260906032206) is ANDed with the
-- policy above for authenticated readers. Story images are as public as
-- avatars, so give the `stories` bucket the same carve-out — but only if that
-- migration has already run (it may land in a different order in a parallel
-- branch). Story rendering itself does not depend on this: the images are
-- served from the bucket's public download endpoint, which bypasses RLS.
DO $$
BEGIN
  IF to_regprocedure('private.has_active_auth_session()') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Require live auth session for private files" ON storage.objects;
    CREATE POLICY "Require live auth session for private files"
    ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
    USING (bucket_id IN ('avatar', 'stories') OR (SELECT private.has_active_auth_session()))
    WITH CHECK (bucket_id IN ('avatar', 'stories') OR (SELECT private.has_active_auth_session()));
  END IF;
END $$;
