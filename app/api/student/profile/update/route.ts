import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/server-auth'
import { getServiceSupabase } from '@/lib/server-supabase'

export async function PATCH(request: NextRequest) {
    try {
        const user = await getRequestUser(request)
        if (!user) {
            return NextResponse.json(
                { error: 'Avtentifikatsiya talab qilinadi' },
                { status: 401 }
            )
        }

        const body = await request.json()
        const { userId, full_name, phone, faculty, room_number } = body
        const groupVal = typeof body.group === 'string' ? body.group : undefined

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID topilmadi' },
                { status: 400 }
            )
        }

        if (userId !== user.id) {
            return NextResponse.json(
                { error: 'Faqat o‘z profilingizni yangilashingiz mumkin' },
                { status: 403 }
            )
        }

        const updates: Record<string, string | number> = {}

        if (full_name) updates.full_name = full_name
        if (phone) updates.phone_number = phone
        if (faculty) updates.faculty = faculty
        if (groupVal) updates.group = groupVal
        if (room_number) updates.room_number = room_number

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { error: 'Yangilash uchun ma\'lumot topilmadi' },
                { status: 400 }
            )
        }

        const supabase = getServiceSupabase()
        const { data, error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select()
            .single()

        if (error) {
            console.error('Update xatosi:', error)
            return NextResponse.json(
                { error: 'Profilni yangilashda xato: ' + error.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            data: data,
            message: 'Profil muvaffaqiyatli yangilandi'
        })

    } catch (error) {
        console.error('Unexpected error:', error)
        return NextResponse.json(
            { error: 'Server xatosi' },
            { status: 500 }
        )
    }
}
