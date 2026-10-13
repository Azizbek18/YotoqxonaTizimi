import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'
import { daysLeft, tashkentToday } from '@/features/foreign-docs/domain/expiry'

const COLUMNS = 'id, full_name, email, phone_number, gender, faculty, direction, course, group, hemis_student_id, country, residence_address, residence_lat, residence_lng, status, off_campus_verified_by, off_campus_verified_at, created_at'

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

    const rows = data ?? []

    // Har talabaning eng yaqin (yoki o'tib ketgan) hujjat muddati — viza,
    // propiska va ijara ichidan eng kichik "qolgan kun". Hujjati yo'q = null.
    const worstDays = new Map<string, number>()
    const docCounts = new Map<string, number>()
    if (rows.length > 0) {
      const { data: docs, error: docsError } = await supabase
        .from('foreign_student_documents')
        .select('student_id, expires_on')
        .in('student_id', rows.map((s) => s.id))
        .neq('status', 'cancelled')
      if (docsError) throw docsError
      const today = tashkentToday()
      for (const doc of docs ?? []) {
        const d = daysLeft(doc.expires_on, today)
        const prev = worstDays.get(doc.student_id)
        if (prev === undefined || d < prev) worstDays.set(doc.student_id, d)
        docCounts.set(doc.student_id, (docCounts.get(doc.student_id) ?? 0) + 1)
      }
    }
    const students = rows.map((s) => ({
      ...s,
      docs_worst_days: worstDays.get(s.id) ?? null,
      docs_count: docCounts.get(s.id) ?? 0,
    }))
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
