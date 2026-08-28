import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { requireScopedTarbiyachi, isWithinTarbiyachiFloor, type ScopedTarbiyachi } from '@/server/auth/tarbiyachi'

type ApplicationLevel = 'info' | 'warning' | 'critical'

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

async function getScopedStudentIds(
  serviceSupabase: ReturnType<typeof getServiceSupabase>,
  staffUser: ScopedTarbiyachi
) {
  let query = serviceSupabase
    .from('users')
    .select('id, room_number, assigned_floor, gender, faculty')
    .eq('role', 'talaba')

  // Gender is an exact-match field, so it can be pushed down into SQL to cut
  // down the number of rows fetched. Floor is derived from room_number via
  // regex and stays as a JS filter below.
  if (staffUser.assigned_gender) {
    query = query.ilike('gender', staffUser.assigned_gender)
  }

  const { data: students, error } = await query

  if (error) throw error

  return (students ?? [])
    .filter((student) => isWithinTarbiyachiFloor(staffUser, student))
    .map((student) => student.id as string)
}

export async function GET(req: NextRequest) {
  try {
    const scoped = await requireScopedTarbiyachi(req)
    if (scoped.error) return scoped.error
    const { staffUser, serviceSupabase } = scoped

    const studentIds = await getScopedStudentIds(serviceSupabase, staffUser)

    if (studentIds.length === 0) {
      return NextResponse.json({
        ok: true,
        requests: [],
        scope: { assigned_floor: staffUser.assigned_floor ?? null, assigned_gender: staffUser.assigned_gender ?? null },
      })
    }

    const { data: requests, error } = await serviceSupabase
      .from('arizalar')
      .select('id, student_id, student_name, text, type, level, status, created_at, response_date')
      .in('student_id', studentIds)
      .in('type', ['ariza', 'tushuntirish'])
      .neq('status', 'draft')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Scoped staff applications lookup failed:', error)
      return jsonError('Arizalarni yuklab bo‘lmadi', 500)
    }

    const formatted = (requests ?? []).map((request) => ({
      id: String(request.id),
      student_name: request.student_name ?? "Noma'lum",
      text: request.text ?? '',
      type: request.type ?? 'ariza',
      level: (request.level ?? 'info') as ApplicationLevel,
      status: request.status ?? 'pending',
      created_at: request.created_at ?? null,
      response_date: request.response_date ?? null,
    }))

    return NextResponse.json({
      ok: true,
      requests: formatted,
      scope: { assigned_floor: staffUser.assigned_floor ?? null, assigned_gender: staffUser.assigned_gender ?? null },
    })
  } catch (error) {
    console.error('Staff arizalar GET xato:', error)
    return jsonError('Arizalarni yuklashda server xatosi yuz berdi', 500)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const scoped = await requireScopedTarbiyachi(req)
    if (scoped.error) return scoped.error
    const { staffUser, serviceSupabase } = scoped

    const body = await req.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const status = typeof body.status === 'string' ? body.status : undefined

    if (!id) {
      return jsonError("So'rov ma'lumotlari noto'g'ri", 400)
    }

    // Staff may only decide a pending application one way or the other —
    // never set it to 'draft'/'submitted' (student-only states) and never
    // re-open or flip an already-decided one after the fact.
    if (status !== 'approved' && status !== 'rejected') {
      return jsonError("Status faqat 'approved' yoki 'rejected' bo'lishi mumkin", 400)
    }

    // Security: only allow updating an ariza that belongs to a student within this staff member's scope
    const { data: existing, error: fetchError } = await serviceSupabase
      .from('arizalar')
      .select('student_id')
      .eq('id', id)
      .maybeSingle<{ student_id: string | null }>()

    if (fetchError) {
      console.error('Scoped staff application lookup failed:', fetchError)
      return jsonError('Arizani tekshirib bo‘lmadi', 500)
    }
    if (!existing?.student_id) {
      return jsonError('Ariza topilmadi', 404)
    }

    const studentIds = await getScopedStudentIds(serviceSupabase, staffUser)
    if (!studentIds.includes(existing.student_id)) {
      return jsonError('Ushbu arizani boshqarish huquqingiz yo\'q', 403)
    }

    const { data: updated, error } = await serviceSupabase
      .from('arizalar')
      .update({ status, response_date: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Scoped staff application update failed:', error)
      return jsonError('Ariza holatini yangilab bo‘lmadi', 500)
    }
    if (!updated) {
      return jsonError('Bu ariza allaqachon ko\'rib chiqilgan', 409)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Staff arizalar PATCH xato:', error)
    return jsonError('Ariza holatini yangilashda server xatosi yuz berdi', 500)
  }
}
