import { NextRequest, NextResponse } from 'next/server'
import { extractFloor } from '@/lib/floor'
import { requireFloorCaptain } from '@/server/auth/sardor'

export async function GET(req: NextRequest) {
  try {
    const scoped = await requireFloorCaptain(req)
    if (scoped.error) return scoped.error
    const { caller, serviceSupabase } = scoped

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
