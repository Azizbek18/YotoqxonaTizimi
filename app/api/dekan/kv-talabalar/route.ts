import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { deleteAuthUserSafely } from '@/lib/supabase-admin-auth'
import { ApiError, getApiError } from '@/server/http/api-error'

const COLUMNS = 'id, full_name, email, phone_number, gender, faculty, direction, course, group, hemis_student_id, status, off_campus_verified_by, off_campus_verified_at, created_at'

// Dekan's queue for KV-talaba (off-campus student) self-registrations —
// the interim verification step this session's plan calls for until
// HEMIS/OneID auto-verification lands (see off_campus_verified_by).
// Mirrors app/api/dekan/staff-invites' faculty-scoping shape.
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

// PATCH { id, action: 'approve' | 'reject' }
export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const faculty = requirePickedFaculty(staff)
    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id.trim() : ''
    const action = body.action === 'approve' || body.action === 'reject' ? body.action : null
    if (!id || !action) throw new ApiError(400, "So'rov noto'g'ri")

    const supabase = getServiceSupabase()

    // Scoped to this dekan's own faculty + still-pending — a dekan can never
    // touch another faculty's queue, and re-approving/re-rejecting an
    // already-decided row is a silent no-op rather than a surprise.
    const { data: target, error: findError } = await supabase
      .from('users')
      .select('id, faculty, status, is_off_campus')
      .eq('id', id)
      .eq('role', 'talaba')
      .eq('is_off_campus', true)
      .ilike('faculty', faculty)
      .maybeSingle()
    if (findError) throw findError
    if (!target || target.status !== 'pending') {
      return NextResponse.json({ error: "Talaba topilmadi yoki allaqachon ko'rib chiqilgan" }, { status: 404 })
    }

    if (action === 'approve') {
      const { error: updateError } = await supabase
        .from('users')
        .update({ status: 'active', off_campus_verified_by: 'dekan', off_campus_verified_at: new Date().toISOString() })
        .eq('id', id)
      if (updateError) throw updateError
      return NextResponse.json({ ok: true, status: 'active' })
    }

    // Reject: no half-account left behind — same as a rejected permit never
    // leaving an orphaned login. Delete the profile row first: a retry after
    // a failed Auth-user delete just leaves an Auth user with no profile
    // (can't sign in usefully), vs. the reverse, which would be unrecoverable.
    const { error: deleteError } = await supabase.from('users').delete().eq('id', id)
    if (deleteError) throw deleteError
    await deleteAuthUserSafely(id)
    return NextResponse.json({ ok: true, status: 'rejected' })
  } catch (error) {
    console.error('KV-talaba PATCH failed:', error)
    const response = getApiError(error, "Amalni bajarib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
