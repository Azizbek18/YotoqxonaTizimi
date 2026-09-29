import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'

const COLUMNS = 'id, full_name, email, phone_number, gender, faculty, direction, course, group, hemis_student_id, status, off_campus_verified_by, off_campus_verified_at, created_at'

// Dekan's read-only list of KV-talaba (off-campus student) accounts. They
// register themselves and are active at once — there is no approval step, so
// `pending` is normally empty (kept only so an old row is never hidden).
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const faculty = requirePickedFaculty(staff)
    const supabase = getServiceSupabase()

    const { data, error } = await supabase
      .from('users')
      .select(COLUMNS)
      .eq('role', 'talaba')
      .eq('is_off_campus', true)
      .ilike('faculty', faculty)
      .order('created_at', { ascending: false })

    if (error) throw error

    const students = data ?? []
    return NextResponse.json({
      ok: true,
      pending: students.filter((s) => s.status === 'pending'),
      active: students.filter((s) => s.status === 'active'),
    })
  } catch (error) {
    console.error('KV-talaba list GET failed:', error)
    const response = getApiError(error, "Ro'yxatni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
