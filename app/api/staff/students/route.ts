import { NextRequest, NextResponse } from 'next/server'
import { requireScopedTarbiyachi, isWithinTarbiyachiFloor } from '@/server/auth/tarbiyachi'

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function GET(req: NextRequest) {
  try {
    const scoped = await requireScopedTarbiyachi(req)
    if (scoped.error) return scoped.error
    const { staffUser, serviceSupabase } = scoped

    let studentsQuery = serviceSupabase
      .from('users')
      .select('id, full_name, email, phone_number, faculty, direction, course, group, room_number, assigned_floor, avatar_url, gender, status, warning_count, created_at')
      .eq('role', 'talaba')
      .order('created_at', { ascending: false })

    // Gender is an exact-match field, so it can be pushed down into SQL to cut
    // down the number of rows fetched. Floor is derived from room_number via
    // regex and stays as a JS filter below.
    if (staffUser.assigned_gender) {
      studentsQuery = studentsQuery.ilike('gender', staffUser.assigned_gender)
    }

    const { data: students, error: studentsError } = await studentsQuery

    if (studentsError) {
      console.error('Scoped staff student lookup failed:', studentsError)
      return jsonError('Talabalarni yuklab bo‘lmadi', 500)
    }

    const filteredStudents = (students ?? []).filter((student) => isWithinTarbiyachiFloor(staffUser, student))

    return NextResponse.json({
      ok: true,
      students: filteredStudents,
      scope: {
        assigned_floor: staffUser.assigned_floor ?? null,
        assigned_gender: staffUser.assigned_gender ?? null,
      },
    })
  } catch (error) {
    console.error('Staff students GET xato:', error)
    return jsonError('Talabalarni yuklashda server xatosi yuz berdi', 500)
  }
}
