import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { requireActiveStaff } from '@/server/auth/guards'
import { staffFacultyOrPrimary } from '@/server/auth/faculty'
import { normalizeFaculty } from '@/lib/faculties'
import { ApiError, getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'

function errorResponse(error: unknown) {
  console.error('Admin chat API error:', error instanceof Error ? (error.stack ?? error.message) : error)
  const response = getApiError(error, 'Chat so\'rovini bajarib bo\'lmadi')
  return NextResponse.json({ ok: false, ...response.body }, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = staffFacultyOrPrimary(staff.faculty)
    const studentId = request.nextUrl.searchParams.get('studentId')?.trim()
    if (!studentId) throw new ApiError(400, 'Talaba identifikatori talab qilinadi')
    // Scoped by faculty: a chat thread with another faculty's student
    // returns nothing rather than leaking the conversation.
    const { data, error } = await getServiceSupabase()
      .from('arizalar')
      .select('*')
      .eq('student_id', studentId)
      .eq('faculty', faculty)
      .eq('type', 'chat')
      .order('created_at', { ascending: true })
    if (error) throw error
    return NextResponse.json({ ok: true, messages: data ?? [] })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, staff } = await requireActiveStaff(request, ['admin', 'dekan'])
    const throttle = await checkRateLimit(`admin-chat:${user.id}`, 60, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ ok: false, error: "Juda ko'p xabar yuborildi. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const faculty = staffFacultyOrPrimary(staff.faculty)
    const body = await request.json().catch(() => ({}))
    const studentId = typeof body.student_id === 'string' ? body.student_id.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : ''
    if (!studentId || !message) throw new ApiError(400, 'So\'rov ma\'lumotlari noto\'g\'ri')

    const supabase = getServiceSupabase()
    const { data: student, error: studentError } = await supabase
      .from('users')
      .select('id, full_name, faculty, direction, course')
      .eq('id', studentId)
      .eq('role', 'talaba')
      .maybeSingle()
    if (studentError) throw studentError
    if (!student) throw new ApiError(404, 'Talaba topilmadi')
    if ((normalizeFaculty(student.faculty) ?? 'amit') !== faculty) {
      throw new ApiError(403, 'Boshqa fakultet talabasi bilan yozishib bo\'lmaydi')
    }

    const { data, error } = await supabase
      .from('arizalar')
      .insert({
        student_id: studentId,
        student_name: student.full_name,
        faculty,
        direction: student.direction,
        course: student.course ?? 1,
        type: 'chat',
        title: 'admin',
        reason: message,
        text: message,
        level: 'info',
        status: 'submitted',
        date: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, message: data })
  } catch (error) {
    return errorResponse(error)
  }
}
