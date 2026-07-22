import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getAdminSession } from '@/lib/server-admin'
import { getServiceSupabase } from '@/lib/server-supabase'

export async function POST(request: NextRequest) {
    try {
        const { session, isAdmin } = await getAdminSession()

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Autentifikatsiya bo\'lmagan' },
                { status: 401 }
            )
        }

        if (!isAdmin) {
            return NextResponse.json(
                { error: 'Admin huquqlari talab etiladi' },
                { status: 403 }
            )
        }

        const { email } = await request.json()
        const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : ''

        if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
            return NextResponse.json(
                { error: 'Email kerak' },
                { status: 400 }
            )
        }

        // Taklif kodini yaratish
        const inviteCode = crypto.randomBytes(16).toString('hex')
        const tokenHash = crypto.createHash('sha256').update(inviteCode).digest('hex')

        const serviceSupabase = getServiceSupabase()
        const { error: insertError } = await serviceSupabase
            .from('admin_invites')
            .insert({
                token_hash: tokenHash,
                email: cleanEmail,
                created_by: session.user.id,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 24 * 60 * 60_000).toISOString(),
                used: false,
            })

        if (insertError) {
            throw insertError
        }

        return NextResponse.json({
            success: true,
            inviteCode,
            message: 'Taklif kodi muvaffaqiyatli yaratildi',
        })
    } catch (error) {
        console.error('Taklif kodini yaratishda xato:', error)
        return NextResponse.json(
            { error: 'Taklif kodini yaratishda xato!' },
            { status: 500 }
        )
    }
}

export async function GET() {
    try {
        const { session, isAdmin } = await getAdminSession()

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Autentifikatsiya bo\'lmagan' },
                { status: 401 }
            )
        }

        if (!isAdmin) {
            return NextResponse.json(
                { error: 'Admin huquqlari talab etiladi' },
                { status: 403 }
            )
        }

        // Taklif kodlarini olish (Service Role orqali - RLS'ni aylanib o'tish uchun)
        const serviceSupabase = getServiceSupabase()
        const { data: invites, error } = await serviceSupabase
            .from('admin_invites')
            .select('id, email, created_by, created_at, expires_at, used, used_at')
            .order('created_at', { ascending: false })

        if (error) {
            throw error
        }

        return NextResponse.json({
            success: true,
            invites,
        })
    } catch (error) {
        console.error('Taklif kodlarini olishda xato:', error)
        return NextResponse.json(
            { error: 'Taklif kodlarini olishda xato!' },
            { status: 500 }
        )
    }
}
