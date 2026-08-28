import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { getRequestUser } from '@/lib/server-auth'
import { findStaffRowByIdentity } from '@/lib/auth-tables'
import { normalizeFaculty, PRIMARY_FACULTY } from '@/lib/faculties'

export type ScopedTarbiyachi = {
  id: string
  email: string
  role: string
  status?: string | null
  faculty?: string | null
}

// A tarbiyachi supervises their faculty's WHOLE dormitory — every floor,
// both genders — not a single floor. Every /api/staff/* route requires the
// caller to be an active tarbiyachi and scopes reads to their faculty's
// residents.
export async function requireScopedTarbiyachi(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user?.id) {
    return { error: NextResponse.json({ ok: false, error: 'Autentifikatsiya talab qilinadi' }, { status: 401 }) } as const
  }

  const serviceSupabase = getServiceSupabase()
  const staffUser = await findStaffRowByIdentity<ScopedTarbiyachi>(
    serviceSupabase,
    'id, email, role, status, faculty',
    { id: user.id, email: user.email },
  )

  if (!staffUser || staffUser.role !== 'tarbiyachi' || staffUser.status !== 'active') {
    return { error: NextResponse.json({ ok: false, error: 'Tarbiyachi huquqi talab qilinadi' }, { status: 403 }) } as const
  }

  const faculty = normalizeFaculty(staffUser.faculty ?? null)
  if (!faculty) {
    console.error('Active tarbiyachi has no faculty:', staffUser.id)
    return {
      error: NextResponse.json(
        { ok: false, error: 'Tarbiyachi profili fakultetga biriktirilmagan' },
        { status: 403 },
      ),
    } as const
  }

  return { staffUser, serviceSupabase, faculty } as const
}

// Whether a student belongs to this tarbiyachi's faculty dormitory. A
// faculty-less staff or student row is treated as the primary building's
// during the transition, so today's single-building behaviour is unchanged.
export function isTarbiyachiStudent(
  staffUser: Pick<ScopedTarbiyachi, 'faculty'>,
  student: { faculty?: string | null },
) {
  const staffFaculty = normalizeFaculty(staffUser.faculty ?? null) ?? PRIMARY_FACULTY
  const studentFaculty = normalizeFaculty(student.faculty ?? null) ?? PRIMARY_FACULTY
  return staffFaculty === studentFaculty
}
