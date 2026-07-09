import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

interface Profile {
    id: string
    full_name: string
    email: string
    phone?: string
    faculty?: string
    role?: string
    room_number?: string
    course?: string | number
    group?: string | number
    avatar_url?: string
}

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

export async function GET(request: NextRequest) {
    try {
        // Autentifikatsiya qilingan foydalanuvchini olish
        const { data: { user }, error: authError } = await supabase.auth.getUser(
            request.headers.get('authorization')?.split('Bearer ')[1]
        )

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Avtorizatsiya xatosi' },
                { status: 401 }
            )
        }

        // Hozirgi talabaning profilini olish
        const { data: profile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user.id)
            .single()

        if (profileError || !profile) {
            return NextResponse.json(
                { error: 'Profil topilmadi' },
                { status: 404 }
            )
        }

        let roommates: Profile[] = []

        // Agar xona raqami bo'lsa, xonadoshlarni olish
        if (profile.room_number) {
            const { data: roommatesData, error: roommatesError } = await supabase
                .from('users')
                .select('id, full_name, email, phone_number, faculty, role, room_number, course, group, avatar_url')
                .eq('room_number', profile.room_number)
                .neq('id', user.id)
                .order('full_name', { ascending: true })

            if (!roommatesError && roommatesData) {
                roommates = roommatesData as Profile[]
            }
        }

        return NextResponse.json({
            success: true,
            profile: profile,
            roommates: roommates,
            roommatesCount: roommates.length
        })

    } catch (error) {
        console.error('Profile fetch xatosi:', error)
        return NextResponse.json(
            { error: 'Server xatosi' },
            { status: 500 }
        )
    }
}
