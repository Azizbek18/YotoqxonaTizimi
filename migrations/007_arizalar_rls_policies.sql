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
