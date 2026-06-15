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

-- 3. Update the check constraint on audience to allow floor-specific targeting
ALTER TABLE elonlar DROP CONSTRAINT IF EXISTS elonlar_audience_check;
ALTER TABLE elonlar ADD CONSTRAINT elonlar_audience_check 
CHECK (audience IN ('all', 'faculty', 'floor'));
