import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        const { userId, full_name, phone_number, faculty, room_number } = body
        const groupVal = typeof body.group === 'string' ? body.group : undefined

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID topilmadi' },
                { status: 400 }
            )
        }

        const updates: Record<string, string | number> = {}

        if (full_name) updates.full_name = full_name
        if (phone_number) updates.phone_number = phone_number
        if (faculty) updates.faculty = faculty
        if (groupVal) updates.group = groupVal
        if (room_number) updates.room_number = room_number

        if (Object.keys(updates).length === 0) {
            return NextResponse.json(
                { error: 'Yangilash uchun ma\'lumot topilmadi' },
                { status: 400 }
            )
        }

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
