import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { getRequestUser } from '@/lib/server-auth'
import { normalizeFaculty } from '@/lib/faculties'
import { can, type RaisiPermission } from '@/features/permissions/types'

export type CouncilChair = {
  id: string
  full_name: string | null
  role: string
  status: string | null
  is_council_chair: boolean | null
  gender: string | null
  faculty: string | null
  council_chair_permissions?: unknown
}

// Every /api/kengash/* route requires the caller to be an active council
// chair (talaba kengashi raisi) student, scoped to the WHOLE faculty —
// both genders, unlike a sardor, who has one floor to narrow to. A faculty
// can have up to two chairs (one appointed per gender, see the dekan's
// "Talaba kengashi raisi" picker), but either one now represents — and can
// see/manage — every student of their faculty, not just their own gender's
// half (explicit product decision: a chair should never leave the other
// gender with zero visible representation just because no one's appointed
// there yet).
//
// `permission` narrows it further: the dekan can revoke any single right at
// any time (features/permissions), and a revoked one closes the section
// outright rather than leaving a dead button.
export async function requireCouncilChair(request: NextRequest, permission?: RaisiPermission) {
  const user = await getRequestUser(request)
  if (!user?.id) {
    return { error: NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 }) } as const
  }

  const serviceSupabase = getServiceSupabase()
  const { data: caller, error } = await serviceSupabase
    .from('users')
    .select('id, full_name, role, status, is_council_chair, gender, faculty, council_chair_permissions')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !caller || caller.role !== 'talaba' || caller.status !== 'active' || !caller.is_council_chair) {
    return { error: NextResponse.json({ error: 'Siz talaba kengashi raisi emassiz' }, { status: 403 }) } as const
  }

  if (permission && !can(caller.council_chair_permissions, permission)) {
    return {
      error: NextResponse.json(
        { error: 'Bu bo‘lim uchun dekan ruxsat bermagan', code: 'PERMISSION_REVOKED' },
        { status: 403 },
      ),
    } as const
  }

  // A raisi's scope is their whole faculty's student body, both genders.
  // Missing / unrecognised faculty fails closed — never silently widens.
  const faculty = normalizeFaculty(caller.faculty)
  if (!faculty) {
    return { error: NextResponse.json({ error: 'Fakultet biriktirilmagan' }, { status: 403 }) } as const
  }

  return { caller: caller as CouncilChair, serviceSupabase, faculty } as const
}
