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
