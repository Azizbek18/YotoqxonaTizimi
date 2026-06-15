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
