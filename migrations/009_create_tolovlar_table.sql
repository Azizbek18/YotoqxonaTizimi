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

CREATE POLICY "Students can insert their own payments"
ON tolovlar FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = student_id
);

CREATE POLICY "Students can update their own payments"
ON tolovlar FOR UPDATE
TO authenticated
USING (
  auth.uid() = student_id
)
WITH CHECK (
  auth.uid() = student_id
);

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
CREATE POLICY "Anyone can upload receipts" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Anyone can view receipts" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'receipts');
