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
