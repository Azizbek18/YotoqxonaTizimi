import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-admin'
import { getServiceSupabase } from '@/lib/server-supabase'

function extractFloor(roomNumber: string | null | undefined): number | null {
  if (!roomNumber) return null
  const num = parseInt(roomNumber.trim().replace(/\D/g, ''))
  if (isNaN(num)) return null
  return Math.floor((num - 1) / 30) + 1
}

export async function GET() {
  try {
    const authSupabase = await createServerSupabaseClient()
    const serviceSupabase = getServiceSupabase()
    const {
      data: { session },
    } = await authSupabase.auth.getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })
    }

    // Fetch caller profile
    const { data: caller, error: callerError } = await serviceSupabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (callerError || !caller || !caller.is_floor_captain) {
      return NextResponse.json({ error: 'Siz qavat sardori emassiz' }, { status: 403 })
    }

    const captainFloor = caller.assigned_floor
    const captainGender = caller.gender

    if (!captainFloor || !captainGender) {
      return NextResponse.json({ error: 'Sardorlik qavati yoki jinsi belgilanmagan' }, { status: 400 })
    }

    // Query students of same gender
    const { data: students, error: studentsError } = await serviceSupabase
      .from('users')
      .select('id, full_name, email, phone_number, room_number, faculty, course, group, avatar_url, gender')
      .eq('role', 'talaba')
      .eq('gender', captainGender)

    if (studentsError) {
      return NextResponse.json({ error: studentsError.message }, { status: 500 })
    }

    // Filter by floor
    const floorStudents = (students ?? []).filter(s => {
      const floor = extractFloor(s.room_number)
      return floor === captainFloor
    })

    return NextResponse.json({ ok: true, students: floorStudents, floor: captainFloor, gender: captainGender })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Server xatoligi'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
