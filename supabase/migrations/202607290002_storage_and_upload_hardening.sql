-- Align storage with the 4.5 MB Vercel Function body ceiling and remove the
-- unused public legacy avatar bucket. All sensitive document reads/writes go
-- through validated service-role Route Handlers.

UPDATE storage.buckets
SET public = true,
    file_size_limit = 4194304,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'avatar';

UPDATE storage.buckets
SET public = false,
    file_size_limit = 4194304,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'avatars';

UPDATE storage.buckets
SET public = false,
    file_size_limit = 4194304,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
WHERE id IN ('permits', 'receipts', 'cheklar');

DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'avatar');

DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

UPDATE public.app_settings
SET max_upload_size_mb = LEAST(GREATEST(max_upload_size_mb, 1), 4)
WHERE max_upload_size_mb NOT BETWEEN 1 AND 4;

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_max_upload_size_mb_check;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_max_upload_size_mb_check
  CHECK (max_upload_size_mb BETWEEN 1 AND 4);
