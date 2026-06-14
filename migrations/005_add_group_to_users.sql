-- Migration: Add 'group' column to users table
-- The 'group' column stores the student's academic group number

ALTER TABLE users
ADD COLUMN IF NOT EXISTS "group" text;
