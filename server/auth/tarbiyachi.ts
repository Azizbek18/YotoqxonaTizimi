import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { getRequestUser } from '@/lib/server-auth'
import { findStaffRowByIdentity } from '@/lib/auth-tables'
import { normalizeFaculty } from '@/lib/faculties'
import { staffDormFaculties } from '@/server/auth/faculty'

export type ScopedTarbiyachi = {
  id: string
  email: string
  role: string
  status?: string | null
  faculty?: string | null
}

// A tarbiyachi supervises their WHOLE dormitory building — every floor,
// both genders, and (shared-dorm tenancy, P4) every faculty living there.
// Every /api/staff/* route requires the caller to be an active tarbiyachi
// and scopes reads to `dormFaculties` — the faculties sharing their dorm.
// In a single-faculty building that is just `[faculty]`, unchanged.
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

  const dormFaculties = await staffDormFaculties(staffUser.id, staffUser.faculty)

  return { staffUser, serviceSupabase, faculty, dormFaculties } as const
}
