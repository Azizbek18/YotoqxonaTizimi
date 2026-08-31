-- Keep the database setting aligned with the server and Storage bucket.
-- The upload pipeline has a hard 4 MiB ceiling; a larger dorm setting makes
-- the UI promise a size that the server will reject.
UPDATE public.dorms
SET max_upload_size_mb = 4,
    updated_at = now()
WHERE max_upload_size_mb > 4;

ALTER TABLE public.dorms
  ALTER COLUMN max_upload_size_mb SET DEFAULT 4;

ALTER TABLE public.dorms
  DROP CONSTRAINT IF EXISTS dorms_max_upload_size_mb_check;
ALTER TABLE public.dorms
  ADD CONSTRAINT dorms_max_upload_size_mb_check
  CHECK (max_upload_size_mb BETWEEN 1 AND 4);
