import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { getRequestUser } from '@/lib/server-auth'
import { findStaffRowByIdentity } from '@/lib/auth-tables'
import { extractFloor } from '@/lib/floor'

export type ScopedTarbiyachi = {
  id: string
  email: string
  role: string
  assigned_floor?: number | null
  assigned_gender?: string | null
  status?: string | null
}

// Every /api/staff/* route requires the caller to be an active tarbiyachi,
// scoped to the residents on their own assigned_floor + assigned_gender.
// This was previously hand-rolled per handler.
export async function requireScopedTarbiyachi(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user?.id) {
    return { error: NextResponse.json({ ok: false, error: 'Autentifikatsiya talab qilinadi' }, { status: 401 }) } as const
  }

  const serviceSupabase = getServiceSupabase()
  const staffUser = await findStaffRowByIdentity<ScopedTarbiyachi>(
    serviceSupabase,
    'id, email, role, assigned_floor, assigned_gender, status',
    { id: user.id, email: user.email },
  )

  if (!staffUser || staffUser.role !== 'tarbiyachi' || staffUser.status !== 'active') {
    return { error: NextResponse.json({ ok: false, error: 'Tarbiyachi huquqi talab qilinadi' }, { status: 403 }) } as const
  }

  return { staffUser, serviceSupabase } as const
}

// Whether a student's room falls within this tarbiyachi's assigned floor
// (an unset assigned_floor means "all floors"). Prefers the student's own
// `assigned_floor` column (kept in sync with floor_room_layout by the
// room-assignment flow) over deriving it from room_number text, since the
// latter only holds if rooms happen to follow the assumed 30-per-floor
// numbering scheme.
export function isWithinTarbiyachiFloor(
  staffUser: ScopedTarbiyachi,
  student: { room_number?: string | null; assigned_floor?: number | null },
) {
  if (!staffUser.assigned_floor) return true
  const floor = student.assigned_floor ?? extractFloor(student.room_number ?? null)
  return floor === staffUser.assigned_floor
}
