import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { getRequestUser } from '@/lib/server-auth'
import { extractFloor } from '@/lib/floor'

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req)
    const serviceSupabase = getServiceSupabase()

    if (!user?.id) {
      return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })
    }

    // Fetch caller profile
    const { data: caller, error: callerError } = await serviceSupabase
      .from('users')
      .select('id, role, status, is_floor_captain, assigned_floor, gender')
      .eq('id', user.id)
      .single()

    if (callerError || !caller || caller.role !== 'talaba' || caller.status !== 'active' || !caller.is_floor_captain) {
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
      .eq('status', 'active')
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
