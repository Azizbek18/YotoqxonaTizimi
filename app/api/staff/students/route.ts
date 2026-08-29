import { NextRequest, NextResponse } from 'next/server'
import { requireScopedTarbiyachi } from '@/server/auth/tarbiyachi'

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function GET(req: NextRequest) {
  try {
    const scoped = await requireScopedTarbiyachi(req)
    if (scoped.error) return scoped.error
    const { serviceSupabase, faculty, dormFaculties } = scoped

    // A tarbiyachi sees every student living in their dorm — all faculties.
    const { data: students, error: studentsError } = await serviceSupabase
      .from('users')
      .select('id, full_name, email, phone_number, faculty, direction, course, group, room_number, assigned_floor, avatar_url, gender, status, warning_count, created_at')
      .eq('role', 'talaba')
      .in('faculty', dormFaculties)
      .order('created_at', { ascending: false })

    if (studentsError) {
      console.error('Scoped staff student lookup failed:', studentsError)
      return jsonError('Talabalarni yuklab bo‘lmadi', 500)
    }

    return NextResponse.json({
      ok: true,
      students: students ?? [],
      scope: { faculty, faculties: dormFaculties },
    })
  } catch (error) {
    console.error('Staff students GET xato:', error)
    return jsonError('Talabalarni yuklashda server xatosi yuz berdi', 500)
  }
}
