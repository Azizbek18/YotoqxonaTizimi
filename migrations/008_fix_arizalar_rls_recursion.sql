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
