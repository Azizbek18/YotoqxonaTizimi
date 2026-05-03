-- Demo Account Setup Script for Supabase
-- Run this in your Supabase SQL Editor to create a demo admin account

-- 1. First, create the demo user in auth.users (this is done through Supabase Auth API)
-- You need to use Supabase Dashboard to create the auth user or use the following approach

-- 2. Create the user in the users table
-- Note: The UUID below should match the auth user ID. You can get it from Supabase Auth Dashboard

INSERT INTO users (id, email, role, full_name, created_at)
VALUES (
    'demo-admin-uuid-here', -- Replace with actual UUID from Supabase Auth
    'admin@demo.com',
    'admin',
    'Demo Admin User',
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    role = 'admin';

-- Alternative: If you want to create via the Auth API (JavaScript)
-- You can use the code below in your browser console or in a setup script

/*
import { supabase } from '@/lib/supabase'

async function createDemoAccount() {
    try {
        // 1. Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: 'admin@demo.com',
            password: 'demo123456',
            email_confirm: true,
            user_metadata: {
                name: 'Demo Admin',
                role: 'admin'
            }
        })

        if (authError) {
            console.error('Auth error:', authError)
            return
        }

        const userId = authData.user.id
        console.log('Created auth user:', userId)

        // 2. Create user in users table
        const { error: dbError } = await supabase
            .from('users')
            .insert({
                id: userId,
                email: 'admin@demo.com',
                role: 'admin',
                full_name: 'Demo Admin User'
            })

        if (dbError) {
            console.error('Database error:', dbError)
            return
        }

        console.log('Demo account created successfully!')
        console.log('Email: admin@demo.com')
        console.log('Password: demo123456')
    } catch (error) {
        console.error('Error:', error)
    }
}

createDemoAccount()
*/
