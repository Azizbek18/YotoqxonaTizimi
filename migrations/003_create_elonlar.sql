-- Migration: Create announcements table for admin-to-student messages

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS elonlar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) >= 3),
  text text NOT NULL CHECK (char_length(trim(text)) >= 5),
  type text NOT NULL DEFAULT 'Yangilik'
    CHECK (type IN ('Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish')),
  audience text NOT NULL DEFAULT 'all'
    CHECK (audience IN ('all', 'faculty')),
  faculty text,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  published_at timestamptz DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS elonlar_published_created_idx
ON elonlar (is_published, created_at DESC);

CREATE INDEX IF NOT EXISTS elonlar_audience_faculty_idx
ON elonlar (audience, faculty);

CREATE OR REPLACE FUNCTION set_elonlar_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  IF NEW.is_published = true AND OLD.is_published = false THEN
    NEW.published_at = timezone('utc'::text, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS elonlar_set_updated_at ON elonlar;
CREATE TRIGGER elonlar_set_updated_at
BEFORE UPDATE ON elonlar
FOR EACH ROW
EXECUTE FUNCTION set_elonlar_updated_at();

ALTER TABLE elonlar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published elonlar are readable"
ON elonlar FOR SELECT
USING (is_published = true);

CREATE POLICY "Admins can view all elonlar"
ON elonlar FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid() AND staff.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can insert elonlar"
ON elonlar FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid() AND staff.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can update elonlar"
ON elonlar FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid() AND staff.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid() AND staff.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Admins can delete elonlar"
ON elonlar FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid() AND staff.role = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE elonlar;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$$;
