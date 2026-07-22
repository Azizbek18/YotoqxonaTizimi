-- ==========================================================
-- YOTOQXONA TIZIMI - DATABASE SCHEMA CONSOLIDATION
-- This file combines all database tables, policies, and setups.
-- ==========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==========================================================
-- Core tables required by the application
-- ==========================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE,
  full_name text,
  middle_name text,
  phone text,
  phone_number text,
  faculty text,
  direction text,
  role text DEFAULT 'talaba',
  status text DEFAULT 'pending',
  room_number text,
  course integer,
  "group" text,
  gender text,
  nationality text,
  region text,
  district text,
  mahalla text,
  study_type text,
  entry_date date,
  passport_series text UNIQUE,
  jshshir text UNIQUE,
  passport_date date,
  birth_date date,
  father_full_name text,
  father_workplace text,
  father_phone text,
  mother_full_name text,
  mother_workplace text,
  mother_phone text,
  avatar_url text,
  is_floor_captain boolean DEFAULT false,
  assigned_floor integer,
  warning_count integer DEFAULT 0,
  blacklisted boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);


CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  staff_id text UNIQUE,
  phone_number text,
  role text NOT NULL CHECK (role IN ('admin', 'tarbiyachi')),
  status text DEFAULT 'active',
  assigned_floor integer,
  assigned_gender text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS arizalar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name text,
  faculty text,
  direction text,
  course integer,
  title text,
  type text DEFAULT 'ariza',
  reason text,
  text text NOT NULL,
  level text DEFAULT 'info' CHECK (level IN ('info', 'warning', 'critical')),
  status text DEFAULT 'pending',
  ai_generated boolean DEFAULT false,
  date timestamptz DEFAULT timezone('utc'::text, now()),
  response_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);
CREATE INDEX IF NOT EXISTS users_status_idx ON users(status);
CREATE INDEX IF NOT EXISTS arizalar_student_id_idx ON arizalar(student_id);
CREATE INDEX IF NOT EXISTS arizalar_status_idx ON arizalar(status);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE arizalar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own user profile" ON users;
DROP POLICY IF EXISTS "Users can update own user profile" ON users;
DROP POLICY IF EXISTS "Staff can view students" ON users;
DROP POLICY IF EXISTS "Admins can manage users" ON users;
DROP POLICY IF EXISTS "Staff can view own staff profile" ON staff;

CREATE POLICY "Users can view own user profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Student profile writes go through /api/student/profile/update so protected
-- fields such as role, status, room_number and is_floor_captain cannot be
-- changed with a direct browser query.

CREATE POLICY "Staff can view students"
ON users FOR SELECT
TO authenticated
USING (
  role = 'talaba'
  AND EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
      AND staff.role IN ('admin', 'tarbiyachi')
      AND staff.status = 'active'
  )
);

CREATE POLICY "Admins can manage users"
ON users FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
      AND staff.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
      AND staff.role = 'admin'
      AND staff.status = 'active'
  )
);

CREATE POLICY "Staff can view own staff profile"
ON staff FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- ==========================================================
-- Migration: 001_add_profile_avatar.sql
-- ==========================================================
-- Migration: Add avatar_url and other profile columns if they don't exist
-- This migration ensures the profiles table has all necessary columns for the new features

-- Step 1: Create or ensure profiles table exists with necessary columns
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  email text,
  phone text,
  faculty text,
  role text,
  room_number text,
  course integer,
  "group" text,
  avatar_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Step 2: Add missing columns if they don't exist (for existing tables)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- Step 3: Create storage buckets for avatars if they don't exist.
-- The application uses the singular "avatar" bucket; "avatars" is kept for older installs.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatar', 'avatar', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Step 4: Set up storage policies for avatar buckets
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload an avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

CREATE POLICY "Avatar images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id IN ('avatar', 'avatars'));

-- Avatar mutations are handled by the validated server upload endpoint.

-- Step 5: Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for profiles table
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ==========================================================
-- Migration: 002_add_staff_floor_scope.sql
-- ==========================================================
ALTER TABLE staff
ADD COLUMN IF NOT EXISTS assigned_floor integer,
ADD COLUMN IF NOT EXISTS assigned_gender text;

-- ==========================================================
-- Migration: 003_create_elonlar.sql
-- ==========================================================
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

-- ==========================================================
-- Migration: 004_create_invites.sql
-- ==========================================================
-- Migration: Create admin_invites and staff_invites tables with correct RLS policies
-- Run this in the Supabase SQL Editor to resolve the missing tables issue.

-- 1. Create admin_invites table
CREATE TABLE IF NOT EXISTS admin_invites (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text UNIQUE,
    token_hash text UNIQUE NOT NULL,
    email text NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    used boolean DEFAULT false NOT NULL,
    used_at timestamp with time zone
);

-- Enable Row Level Security (RLS)
ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;

-- Policy to allow ALL other actions only for admins
CREATE POLICY "Admins have full control over admin_invites" 
ON admin_invites 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM staff 
        WHERE staff.id = auth.uid() AND staff.role = 'admin' AND staff.status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM staff 
        WHERE staff.id = auth.uid() AND staff.role = 'admin' AND staff.status = 'active'
    )
);

-- 2. Create staff_invites table
CREATE TABLE IF NOT EXISTS staff_invites (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    token_hash text UNIQUE NOT NULL,
    role text NOT NULL,
    allowed_staff_id text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    used_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;

-- Policy to allow ALL other actions only for admins
CREATE POLICY "Admins have full control over staff_invites" 
ON staff_invites 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM staff 
        WHERE staff.id = auth.uid() AND staff.role = 'admin' AND staff.status = 'active'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM staff 
        WHERE staff.id = auth.uid() AND staff.role = 'admin' AND staff.status = 'active'
    )
);

-- ==========================================================
-- Migration: 005_add_group_to_users.sql
-- ==========================================================
-- Migration: Add 'group' column to users table
-- The 'group' column stores the student's academic group number

ALTER TABLE users
ADD COLUMN IF NOT EXISTS "group" text;

-- ==========================================================
-- Migration: 006_update_arizalar_table.sql
-- ==========================================================
-- Migration: Update arizalar table to support status, title, type, reason, and admin responses
-- Run this in your Supabase SQL Editor to apply the schema updates

-- 1. Add status column (required for admin dashboard stats and student application tracking)
ALTER TABLE arizalar ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted';

-- 2. Add additional columns for rich student application details
ALTER TABLE arizalar ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE arizalar ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'ariza';
ALTER TABLE arizalar ADD COLUMN IF NOT EXISTS reason text;
ALTER TABLE arizalar ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false;
ALTER TABLE arizalar ADD COLUMN IF NOT EXISTS admin_response text;
ALTER TABLE arizalar ADD COLUMN IF NOT EXISTS response_date timestamp without time zone;

-- ==========================================================
-- Migration: 007_arizalar_rls_policies.sql
-- ==========================================================
-- Migration: Setup RLS policies for arizalar table
-- Run this in your Supabase SQL Editor to grant proper permissions

-- Enable RLS on arizalar table (if not already enabled)
ALTER TABLE arizalar ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies to avoid duplication errors
DROP POLICY IF EXISTS "Students can insert their own applications" ON arizalar;
DROP POLICY IF EXISTS "Students can view their own applications" ON arizalar;
DROP POLICY IF EXISTS "Students can update their own applications" ON arizalar;
DROP POLICY IF EXISTS "Students can delete their own applications" ON arizalar;
DROP POLICY IF EXISTS "Admins can view all applications" ON arizalar;
DROP POLICY IF EXISTS "Admins can update all applications" ON arizalar;
DROP POLICY IF EXISTS "Admins can delete all applications" ON arizalar;
DROP POLICY IF EXISTS "Staff can view all applications" ON arizalar;

-- 1. Student Policies
-- Allows authenticated students to insert applications where student_id matches their own user ID
CREATE POLICY "Students can insert their own applications"
ON arizalar FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
);

-- Allows authenticated students to view only their own applications
CREATE POLICY "Students can view their own applications"
ON arizalar FOR SELECT
TO authenticated
USING (
  auth.uid() = student_id
);

-- Allows authenticated students to update their own applications (e.g. submit draft)
CREATE POLICY "Students can update their own applications"
ON arizalar FOR UPDATE
TO authenticated
USING (
  auth.uid() = student_id
)
WITH CHECK (
  auth.uid() = student_id
);

-- Allows authenticated students to delete their own applications
CREATE POLICY "Students can delete their own applications"
ON arizalar FOR DELETE
TO authenticated
USING (
  auth.uid() = student_id
);

-- 2. Admin & Staff Policies
-- Allows Admins (users with 'admin' role) to view all applications
CREATE POLICY "Admins can view all applications"
ON arizalar FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Allows Staff members or users with 'tarbiyachi' role to view all applications
CREATE POLICY "Staff can view all applications"
ON arizalar FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'tarbiyachi'
  )
);

-- Allows Admins to update (moderate/respond to) any application
CREATE POLICY "Admins can update all applications"
ON arizalar FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Allows Admins to delete any application
CREATE POLICY "Admins can delete all applications"
ON arizalar FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- ==========================================================
-- Migration: 008_fix_arizalar_rls_recursion.sql
-- ==========================================================
-- Migration: Fix RLS infinite recursion on arizalar table by bypassing staff table
-- Run this in your Supabase SQL Editor to apply the fix

-- 1. Drop existing policies to clean up
DROP POLICY IF EXISTS "Students can insert their own applications" ON arizalar;
DROP POLICY IF EXISTS "Students can view their own applications" ON arizalar;
DROP POLICY IF EXISTS "Students can update their own applications" ON arizalar;
DROP POLICY IF EXISTS "Students can delete their own applications" ON arizalar;
DROP POLICY IF EXISTS "Admins can view all applications" ON arizalar;
DROP POLICY IF EXISTS "Admins can update all applications" ON arizalar;
DROP POLICY IF EXISTS "Admins can delete all applications" ON arizalar;
DROP POLICY IF EXISTS "Staff can view all applications" ON arizalar;
DROP POLICY IF EXISTS "Users can view relevant applications" ON arizalar;
DROP POLICY IF EXISTS "Users can update relevant applications" ON arizalar;
DROP POLICY IF EXISTS "Users can delete relevant applications" ON arizalar;

-- 2. Enable RLS
ALTER TABLE arizalar ENABLE ROW LEVEL SECURITY;

-- 3. Student Insert Policy
CREATE POLICY "Students can insert their own applications"
ON arizalar FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
);

-- 4. Select Policy for Student, Admin, and Tarbiyachi
CREATE POLICY "Users can view relevant applications"
ON arizalar FOR SELECT
TO authenticated
USING (
  auth.uid() = student_id
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'tarbiyachi')
  )
);

-- 5. Update Policy for Student and Admin
CREATE POLICY "Users can update relevant applications"
ON arizalar FOR UPDATE
TO authenticated
USING (
  auth.uid() = student_id
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
)
WITH CHECK (
  auth.uid() = student_id
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- 6. Delete Policy for Student and Admin
CREATE POLICY "Users can delete relevant applications"
ON arizalar FOR DELETE
TO authenticated
USING (
  auth.uid() = student_id
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- ==========================================================
-- Migration: 009_create_tolovlar_table.sql
-- ==========================================================
-- Migration: Create tolovlar (payments) table, receipts bucket, and RLS policies
-- Run this in your Supabase SQL Editor to apply the changes

-- 1. Create payments table
CREATE TABLE IF NOT EXISTS tolovlar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name text NOT NULL,
  month text NOT NULL,
  year integer NOT NULL,
  amount integer NOT NULL DEFAULT 500000,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending', 'rejected', 'waiting', 'approved')),
  receipt_url text,
  admin_message text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS tolovlar_student_id_idx ON tolovlar(student_id);

-- Enable RLS on payments table
ALTER TABLE tolovlar ENABLE ROW LEVEL SECURITY;

-- Clean up any existing policies
DROP POLICY IF EXISTS "Students can view their own payments" ON tolovlar;
DROP POLICY IF EXISTS "Students can update their own payments" ON tolovlar;
DROP POLICY IF EXISTS "Students can insert their own payments" ON tolovlar;
DROP POLICY IF EXISTS "Admins can manage all payments" ON tolovlar;
DROP POLICY IF EXISTS "Staff can view all payments" ON tolovlar;

-- 1. Student Policies
CREATE POLICY "Students can view their own payments"
ON tolovlar FOR SELECT
TO authenticated
USING (
  auth.uid() = student_id
);

-- Payment inserts go through /api/student/payments; no direct student INSERT
-- policy is created because status, amount, receipt URL and AI fields are
-- server-owned integrity data.

-- Students cannot update payment moderation or AI fields. New payments are
-- created by /api/student/payments after file and ownership validation.
DROP POLICY IF EXISTS "Students can update their own payments" ON tolovlar;

-- 2. Admin & Staff Policies
CREATE POLICY "Admins can manage all payments"
ON tolovlar FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

CREATE POLICY "Staff can view all payments"
ON tolovlar FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role = 'tarbiyachi'
  )
);

-- 3. Storage Bucket Creation for Receipts
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

-- Clean up existing storage policies for 'receipts'
DROP POLICY IF EXISTS "Anyone can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view receipts" ON storage.objects;

-- Create storage policies
CREATE POLICY "Anyone can view receipts" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'receipts');

-- ==========================================================
-- Migration: 010_fix_tolovlar_rls_recursion.sql
-- ==========================================================
-- Migration: Fix RLS infinite recursion on tolovlar table by bypassing staff table
-- Run this in your Supabase SQL Editor to apply the fix

-- 1. Drop the recursive policy
DROP POLICY IF EXISTS "Staff can view all payments" ON tolovlar;

-- 2. Re-create the policy checking users.role directly
CREATE POLICY "Staff can view all payments"
ON tolovlar FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'tarbiyachi')
  )
);

-- ==========================================================
-- Migration: 011_add_ai_fields_to_tolovlar.sql
-- ==========================================================
-- Migration: Add AI audit fields to tolovlar table
-- Run this in your Supabase SQL Editor to add AI analysis support

-- 1. Add new columns for AI audit
ALTER TABLE tolovlar 
ADD COLUMN IF NOT EXISTS ai_confidence integer,
ADD COLUMN IF NOT EXISTS ai_extracted_amount integer,
ADD COLUMN IF NOT EXISTS ai_analysis text;

-- 2. Comments explaining the columns
COMMENT ON COLUMN tolovlar.ai_confidence IS 'AI-determined authenticity percentage (0-100)';
COMMENT ON COLUMN tolovlar.ai_extracted_amount IS 'Amount extracted from the receipt by AI (in UZS)';
COMMENT ON COLUMN tolovlar.ai_analysis IS 'Detailed analysis and feedback generated by AI';

-- ==========================================================
-- Migration: 012_add_transaction_id_to_tolovlar.sql
-- ==========================================================
-- Migration: Add transaction_id column to tolovlar table
-- Run this in your Supabase SQL Editor to support duplicate check detection

-- 1. Add transaction_id column
ALTER TABLE tolovlar 
ADD COLUMN IF NOT EXISTS transaction_id text;

-- 2. Add index for fast duplicate lookups
CREATE INDEX IF NOT EXISTS tolovlar_transaction_id_idx ON tolovlar(transaction_id);

-- 3. Comment explaining the column
COMMENT ON COLUMN tolovlar.transaction_id IS 'Unique transaction reference ID extracted from receipt by AI to prevent duplicate submissions';

-- ==========================================================
-- Migration: 013_add_floor_captain.sql
-- ==========================================================
-- Migration: Add Floor Captain support for students and floor-specific announcements
-- This migration should be executed in your Supabase SQL Editor.

-- 1. Add Floor Captain columns to the users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_floor_captain boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS assigned_floor integer DEFAULT NULL;

-- 2. Add target_floor and target_gender to announcements (elonlar) table
ALTER TABLE elonlar 
ADD COLUMN IF NOT EXISTS target_floor integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS target_gender text DEFAULT NULL;

-- 3. Update the check constraint on audience to allow floor-specific targeting.
--    'internal' is also allowed: the sardor (floor captain) duty-schedule
--    feature stores its JSON payload as an elonlar row with audience='internal'
--    specifically so /api/elonlar's student-facing feed (which only matches
--    'all'/'faculty'/'floor') never surfaces it as a real announcement.
ALTER TABLE elonlar DROP CONSTRAINT IF EXISTS elonlar_audience_check;
ALTER TABLE elonlar ADD CONSTRAINT elonlar_audience_check
CHECK (audience IN ('all', 'faculty', 'floor', 'internal'));

-- 4. Floor captains (users.is_floor_captain=true) save the duty schedule
--    via a direct client-side insert/update on elonlar (see
--    app/sardor/dashboard/page.tsx -> handleSaveDuty), so they need their
--    own RLS policy scoped to just that marker row for their own floor/gender.
DROP POLICY IF EXISTS "Floor captains can manage duty schedule" ON elonlar;
CREATE POLICY "Floor captains can manage duty schedule"
ON elonlar FOR ALL
TO authenticated
USING (
  title = 'HAFTALIK_NAVBATCHILIK_JADVALI'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.is_floor_captain = true
      AND users.assigned_floor = elonlar.target_floor
      AND users.gender = elonlar.target_gender
  )
)
WITH CHECK (
  title = 'HAFTALIK_NAVBATCHILIK_JADVALI'
  AND EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.is_floor_captain = true
      AND users.assigned_floor = elonlar.target_floor
      AND users.gender = elonlar.target_gender
  )
);

-- ==========================================================
-- Migration: 014_create_cleaning_schedule.sql
-- ==========================================================
-- Migration: Create cleaning schedule table for room cleaning duty assignments
-- Run this in your Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS cleaning_schedule (
    room_number text PRIMARY KEY,
    schedule jsonb NOT NULL,
    updated_at timestamptz DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE cleaning_schedule ENABLE ROW LEVEL SECURITY;

-- Create Policies for RLS
-- 1. Allow everyone to read the cleaning schedule
CREATE POLICY "Allow public read access" ON cleaning_schedule
    FOR SELECT TO public USING (true);

-- 2. Allow authenticated users to insert/update schedule
CREATE POLICY "Allow authenticated insert/update" ON cleaning_schedule
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Demo credentials are intentionally not embedded in the schema. Create the
-- first administrator through /api/admin/bootstrap with ADMIN_BOOTSTRAP_CODE.

-- ==========================================================
-- ZAMDEKAN ROLE AND PRE-REGISTRATION PERMITS SCHEMA
-- ==========================================================

-- Modify check constraint on staff role to include 'zamdekan'
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_role_check;
ALTER TABLE staff ADD CONSTRAINT staff_role_check CHECK (role IN ('admin', 'tarbiyachi', 'zamdekan'));

-- Add permit_url column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS permit_url text;

-- Create permit_requests table
CREATE TABLE IF NOT EXISTS permit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passport_series text UNIQUE NOT NULL,
  jshshir text UNIQUE NOT NULL,
  full_name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text NOT NULL,
  gender text NOT NULL,
  faculty text NOT NULL,
  direction text NOT NULL,
  course integer NOT NULL,
  permit_url text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'registered')),
  room_number text,
  reject_reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on permit_requests
ALTER TABLE permit_requests ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for permit_requests
DROP POLICY IF EXISTS "Anyone can insert permit requests" ON permit_requests;

DROP POLICY IF EXISTS "Anyone can select permit requests" ON permit_requests;

DROP POLICY IF EXISTS "Staff can manage permit requests" ON permit_requests;
CREATE POLICY "Staff can manage permit requests"
ON permit_requests FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
  )
);

-- Update users table policies to support 'zamdekan' role
DROP POLICY IF EXISTS "Staff can view students" ON users;
CREATE POLICY "Staff can view students"
ON users FOR SELECT
TO authenticated
USING (
  role = 'talaba'
  AND EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
      AND staff.role IN ('admin', 'tarbiyachi', 'zamdekan')
      AND staff.status = 'active'
  )
);

DROP POLICY IF EXISTS "Zamdekan can update students" ON users;
CREATE POLICY "Zamdekan can update students"
ON users FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
      AND staff.role = 'zamdekan'
      AND staff.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
      AND staff.role = 'zamdekan'
      AND staff.status = 'active'
  )
);

-- Update arizalar table policies to support 'zamdekan' role
DROP POLICY IF EXISTS "Zamdekan can update all applications" ON arizalar;
CREATE POLICY "Zamdekan can update all applications"
ON arizalar FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid() AND staff.role = 'zamdekan' AND staff.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid() AND staff.role = 'zamdekan' AND staff.status = 'active'
  )
);

-- enforce_student_permit_approved FUNCTION AND TRIGGER
CREATE OR REPLACE FUNCTION check_student_permit_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'talaba' THEN
    IF NOT EXISTS (
      SELECT 1 FROM permit_requests
      WHERE passport_series = NEW.passport_series
        AND jshshir = NEW.jshshir
        AND status = 'approved'
    ) THEN
      RAISE EXCEPTION 'Ushbu talabaning yotoqxona yo''llanmasi dekan (zamdekan) tomonidan tasdiqlanmagan. Ro''yxatdan o''tish taqiqlanadi!';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_student_permit_approved_trigger ON users;
CREATE TRIGGER enforce_student_permit_approved_trigger
BEFORE INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION check_student_permit_approved();

-- ==========================================================
-- ZAMDEKAN FACULTY SCOPING
-- ==========================================================
-- A zamdekan should only see and act on permit requests from their own
-- faculty. Previously any staff row (any role) could read/write every
-- permit_requests row dorm-wide with no faculty restriction.

ALTER TABLE staff ADD COLUMN IF NOT EXISTS faculty text;

-- Tighten permit_requests access: admin/tarbiyachi keep full access,
-- zamdekan is restricted to rows matching their own assigned faculty
-- (case-insensitive, since faculty is free text on the applicant form).
DROP POLICY IF EXISTS "Staff can manage permit requests" ON permit_requests;
CREATE POLICY "Staff can manage permit requests"
ON permit_requests FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
      AND (
        staff.role IN ('admin', 'tarbiyachi')
        OR (staff.role = 'zamdekan' AND lower(staff.faculty) = lower(permit_requests.faculty))
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM staff
    WHERE staff.id = auth.uid()
      AND (
        staff.role IN ('admin', 'tarbiyachi')
        OR (staff.role = 'zamdekan' AND lower(staff.faculty) = lower(permit_requests.faculty))
      )
  )
);

-- ==========================================================
-- FIX: "staff" jadvalidagi RLS policy'da cheksiz rekursiya
-- ==========================================================
-- "Adminlar barcha xodimlarni ko'ra oladi" policy'si o'zi "staff"
-- jadvalining ichida o'zini so'rar edi (EXISTS (SELECT 1 FROM staff ...)),
-- bu esa cheksiz rekursiyaga sabab bo'lardi va "staff"ga tegadigan har
-- qanday so'rovni (shu jumladan "elonlar" kabi boshqa jadvallarning
-- policy'lari orqali bilvosita) 42P17 xatosi bilan buzardi.

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM staff WHERE staff.id = uid AND staff.role = 'admin');
$$;

REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, anon;

-- Eslatma: shu nomdagi policy'lar bazada turli apostrof belgisi (' va ')
-- bilan dublikat holda mavjud bo'lishi mumkin — DROP POLICY aniq nom
-- bo'yicha faqat bittasiga mos keladi. Shu sabab prefiks bo'yicha
-- dinamik qidirib, hammasini tozalaymiz.
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'staff' AND cmd = 'SELECT'
      AND (
        policyname LIKE 'Adminlar barcha xodimlarni%'
        OR policyname LIKE 'Xodimlar faqat%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.staff', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Adminlar barcha xodimlarni ko'ra oladi"
ON public.staff FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Xodimlar faqat o'z profilini ko'ra oladi"
ON public.staff FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Login sahifasidagi anon (tizimga kirmagan) holatdagi email tekshiruvi
-- uchun (avval bunday policy umuman yo'q edi, shuning uchun bu funksiya
-- allaqachon ishlamas edi):
DROP POLICY IF EXISTS "Anon email orqali mavjudligini tekshiradi" ON public.staff;
CREATE POLICY "Anon email orqali mavjudligini tekshiradi"
ON public.staff FOR SELECT
TO anon
USING (true);

