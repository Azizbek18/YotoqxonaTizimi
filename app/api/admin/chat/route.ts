import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { requireAdmin } from '@/server/auth/guards'
import { ApiError, getApiError } from '@/server/http/api-error'

function errorResponse(error: unknown) {
  console.error('Admin chat API error:', error)
  const response = getApiError(error, 'Chat so\'rovini bajarib bo\'lmadi')
  return NextResponse.json({ ok: false, ...response.body }, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const studentId = request.nextUrl.searchParams.get('studentId')?.trim()
    if (!studentId) throw new ApiError(400, 'Talaba identifikatori talab qilinadi')
    const { data, error } = await getServiceSupabase()
      .from('arizalar')
      .select('*')
      .eq('student_id', studentId)
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
    await requireAdmin(request)
    const body = await request.json().catch(() => ({}))
    const studentId = typeof body.student_id === 'string' ? body.student_id.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 4000) : ''
    if (!studentId || !message) throw new ApiError(400, 'So\'rov ma\'lumotlari noto\'g\'ri')

    const supabase = getServiceSupabase()
    const { data: student, error: studentError } = await supabase
      .from('users')
      .select('id')
      .eq('id', studentId)
      .eq('role', 'talaba')
      .maybeSingle()
    if (studentError) throw studentError
    if (!student) throw new ApiError(404, 'Talaba topilmadi')

    const { data, error } = await supabase
      .from('arizalar')
      .insert({
        student_id: studentId,
        type: 'chat',
        title: 'admin',
        reason: message,
        text: message,
        level: 'info',
        status: 'submitted',
      })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, message: data })
  } catch (error) {
    return errorResponse(error)
  }
}
