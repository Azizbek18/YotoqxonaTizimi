-- Migration: Create admin_invites and staff_invites tables with correct RLS policies
-- Run this in the Supabase SQL Editor to resolve the missing tables issue.

-- 1. Create admin_invites table
CREATE TABLE IF NOT EXISTS admin_invites (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text UNIQUE NOT NULL,
    email text NOT NULL,
    created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    used boolean DEFAULT false NOT NULL,
    used_at timestamp with time zone
);

-- Enable Row Level Security (RLS)
ALTER TABLE admin_invites ENABLE ROW LEVEL SECURITY;

-- Policy to allow SELECT for anyone (needed for registration check client-side)
CREATE POLICY "Allow public select on admin_invites" 
ON admin_invites 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Policy to allow ALL other actions only for admins
CREATE POLICY "Admins have full control over admin_invites" 
ON admin_invites 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM staff 
        WHERE staff.id = auth.uid() AND staff.role = 'admin'
    ) OR EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() AND users.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM staff 
        WHERE staff.id = auth.uid() AND staff.role = 'admin'
    ) OR EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() AND users.role = 'admin'
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

-- Policy to allow SELECT for anyone (needed for staff verification check)
CREATE POLICY "Allow public select on staff_invites" 
ON staff_invites 
FOR SELECT 
TO anon, authenticated
USING (true);

-- Policy to allow ALL other actions only for admins
CREATE POLICY "Admins have full control over staff_invites" 
ON staff_invites 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM staff 
        WHERE staff.id = auth.uid() AND staff.role = 'admin'
    ) OR EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() AND users.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM staff 
        WHERE staff.id = auth.uid() AND staff.role = 'admin'
    ) OR EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() AND users.role = 'admin'
    )
);
