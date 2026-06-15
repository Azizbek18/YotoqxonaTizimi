-- Migration: Add transaction_id column to tolovlar table
-- Run this in your Supabase SQL Editor to support duplicate check detection

-- 1. Add transaction_id column
ALTER TABLE tolovlar 
ADD COLUMN IF NOT EXISTS transaction_id text;

-- 2. Add index for fast duplicate lookups
CREATE INDEX IF NOT EXISTS tolovlar_transaction_id_idx ON tolovlar(transaction_id);

-- 3. Comment explaining the column
COMMENT ON COLUMN tolovlar.transaction_id IS 'Unique transaction reference ID extracted from receipt by AI to prevent duplicate submissions';
