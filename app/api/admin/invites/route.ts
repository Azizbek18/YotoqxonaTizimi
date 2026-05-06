import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

async function createServerSupabaseClient() {
    const cookieStore = await cookies()

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value
                },
                set(name: string, value: string, options: CookieOptions) {
                    cookieStore.set({ name, value, ...options })
                },
                remove(name: string) {
                    cookieStore.delete(name)
                },
            },
        }
    )
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createServerSupabaseClient()

        // Session-ni tekshirish
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Autentifikatsiya bo\'lmagan' },
                { status: 401 }
            )
        }

        // Admin ekanligini tekshirish
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin') {
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

        // Session-ni tekshirish
        const { data: { session } } = await supabase.auth.getSession()

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Autentifikatsiya bo\'lmagan' },
                { status: 401 }
            )
        }

        // Admin ekanligini tekshirish
        const { data: userData } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin') {
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
