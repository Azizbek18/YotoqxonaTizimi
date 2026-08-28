import { NextRequest, NextResponse } from 'next/server'
import { requireFloorCaptain } from '@/server/auth/sardor'
import { normalizeFaculty, PRIMARY_FACULTY } from '@/lib/faculties'

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

    // A sardor's scope is one faculty's building: same faculty, same floor,
    // same gender. Without the faculty filter an AMIT sardor would see
    // another faculty's residents on the same physical floor number.
    const captainFaculty = normalizeFaculty(caller.faculty) ?? PRIMARY_FACULTY

    // assigned_floor is kept in sync with floor_room_layout by the
    // room-assignment flow, so it's the correct source of truth (unlike
    // deriving a floor from the room number's digits, which only holds for
    // the assumed 30-rooms-per-floor numbering and breaks under a custom
    // layout).
    const { data: students, error: studentsError } = await serviceSupabase
      .from('users')
      .select('id, full_name, email, phone_number, room_number, faculty, course, group, avatar_url, gender')
      .eq('role', 'talaba')
      .eq('status', 'active')
      .eq('faculty', captainFaculty)
      .eq('gender', captainGender)
      .eq('assigned_floor', captainFloor)

    if (studentsError) {
      console.error('Captain student lookup failed:', studentsError)
      return NextResponse.json({ error: 'Talabalarni yuklab bo‘lmadi' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, students: students ?? [], floor: captainFloor, gender: captainGender })
  } catch (error: unknown) {
    console.error('Captain students GET failed:', error)
    return NextResponse.json({ error: 'Server xatoligi' }, { status: 500 })
  }
}
