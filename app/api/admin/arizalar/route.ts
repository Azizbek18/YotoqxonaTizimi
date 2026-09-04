import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { requireActiveStaff } from '@/server/auth/guards'
import { requireStaffFaculty, staffFacultyOrPrimary } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'

type ApplicationLevel = 'info' | 'warning' | 'critical'

// A dekan/admin falls back to the primary building when unscoped (the
// admin -> dekan transition); a tarbiyachi must have a real faculty — the
// silent 'amit' fallback would otherwise leak the primary building's
// applications to a legacy null-faculty tarbiyachi.
function resolveArizaFaculty(staff: { role: string; faculty: string | null }) {
  return staff.role === 'tarbiyachi'
    ? requireStaffFaculty(staff.faculty)
    : staffFacultyOrPrimary(staff.faculty)
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

function errorResponse(error: unknown, fallback: string) {
  console.error('Admin arizalar API error:', error)
  const response = getApiError(error, fallback)
  return NextResponse.json({ ok: false, ...response.body }, { status: response.status })
}

// Student applications (night-permit requests, explanation notes). Open to
// dekan (their own faculty) and, during the admin -> dekan transition,
// admin (the primary building). Everything is scoped to that faculty.
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan', 'tarbiyachi'])
    const faculty = resolveArizaFaculty(staff)

    const { data: requests, error } = await getServiceSupabase()
      .from('arizalar')
      .select('id, student_name, text, level, status, created_at')
      .eq('faculty', faculty)
      .in('type', ['ariza', 'tushuntirish'])
      .neq('status', 'draft')
      .order('created_at', { ascending: false })

    if (error) throw error

    const formatted = (requests ?? []).map((request) => ({
      id: String(request.id),
      student_name: request.student_name ?? 'Noma\'lum',
      text: request.text ?? '',
      level: (request.level ?? 'info') as ApplicationLevel,
      status: request.status ?? 'pending',
      created_at: request.created_at ?? null,
      updated_at: null,
    }))

    return NextResponse.json({ ok: true, requests: formatted })
  } catch (error) {
    return errorResponse(error, 'Arizalarni yuklashda server xatosi yuz berdi')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan', 'tarbiyachi'])
    const faculty = resolveArizaFaculty(staff)
    const isTarbiyachi = staff.role === 'tarbiyachi'

    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const level = body.level as ApplicationLevel | undefined
    const status = body.status as string | undefined

    if (!id) return jsonError("So'rov ma'lumotlari noto'g'ri", 400)

    // 'draft'/'submitted' are student-only pre-submission states — staff
    // may only ever set a decided/pending outcome, never those two.
    if (status !== undefined && status !== 'pending' && status !== 'approved' && status !== 'rejected') {
      return jsonError("Status faqat 'pending', 'approved' yoki 'rejected' bo'lishi mumkin", 400)
    }

    // A tarbiyachi only decides pending applications one way or the other —
    // no severity-only edits, and no re-opening an already-decided one
    // (same restriction as /api/staff/arizalar).
    if (isTarbiyachi && (status !== 'approved' && status !== 'rejected')) {
      return jsonError("Tarbiyachi arizani faqat tasdiqlashi yoki rad etishi mumkin", 403)
    }

    const updateFields: { level?: ApplicationLevel; status?: string; response_date?: string | null } = {}
    if (level !== undefined && !isTarbiyachi) updateFields.level = level
    if (status !== undefined) {
      updateFields.status = status
      // Reverting to 'pending' clears any prior decision's response_date too.
      updateFields.response_date = status === 'pending' ? null : new Date().toISOString()
    }

    if (Object.keys(updateFields).length === 0) return jsonError("Yangilash uchun ma'lumot yo'q", 400)

    let query = getServiceSupabase()
      .from('arizalar')
      .update(updateFields)
      .eq('id', id)
      .eq('faculty', faculty)
    // A tarbiyachi may only act on a still-pending application.
    if (isTarbiyachi) query = query.eq('status', 'pending')

    const { data, error } = await query.select('id').maybeSingle()

    if (error) throw error
    if (!data) return jsonError(isTarbiyachi ? "Bu ariza allaqachon ko'rib chiqilgan" : 'Ariza topilmadi', isTarbiyachi ? 409 : 404)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error, 'Ariza holatini yangilashda server xatosi yuz berdi')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = staffFacultyOrPrimary(staff.faculty)

    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) return jsonError("So'rov ma'lumotlari noto'g'ri", 400)

    const { data, error } = await getServiceSupabase()
      .from('arizalar')
      .delete()
      .eq('id', id)
      .eq('faculty', faculty)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) return jsonError('Ariza topilmadi', 404)

    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error, 'Arizani o‘chirishda server xatosi yuz berdi')
  }
}
