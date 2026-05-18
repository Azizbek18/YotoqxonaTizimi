import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServerSupabaseClient, getAdminSession } from '@/lib/server-admin'

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()
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

        if (!email) {
            return NextResponse.json(
                { error: 'Email kerak' },
                { status: 400 }
            )
        }

        // Taklif kodini yaratish
        const inviteCode = crypto.randomBytes(16).toString('hex')

        const { error: insertError } = await supabase
            .from('admin_invites')
            .insert({
                code: inviteCode,
                email: email.toLowerCase(),
                created_by: session.user.id,
                created_at: new Date().toISOString(),
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
        const supabase = await createServerSupabaseClient()
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

        // Taklif kodlarini olish
        const { data: invites, error } = await supabase
            .from('admin_invites')
            .select('*')
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
