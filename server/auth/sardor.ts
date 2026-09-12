import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { getRequestUser } from '@/lib/server-auth'
import { normalizeFaculty } from '@/lib/faculties'
import { can, type SardorPermission } from '@/features/permissions/types'

export type FloorCaptain = {
  id: string
  full_name: string | null
  role: string
  status: string | null
  is_floor_captain: boolean | null
  assigned_floor: number | null
  gender: string | null
  faculty: string | null
  captain_permissions?: unknown
}

// Every /api/sardor/* route requires the caller to be an active, active
// floor-captain student, scoped to the resident/announcement rows for their
// own assigned_floor + gender. This was previously hand-rolled per handler.
//
// `permission` narrows it further: the dekan can revoke any single captain
// right at any time (features/permissions), and a revoked one closes the
// section outright rather than leaving a dead button.
export async function requireFloorCaptain(request: NextRequest, permission?: SardorPermission) {
  const user = await getRequestUser(request)
  if (!user?.id) {
    return { error: NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 }) } as const
  }

  const serviceSupabase = getServiceSupabase()
  const { data: caller, error } = await serviceSupabase
    .from('users')
    .select('id, full_name, role, status, is_floor_captain, assigned_floor, gender, faculty, captain_permissions')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !caller || caller.role !== 'talaba' || caller.status !== 'active' || !caller.is_floor_captain) {
    return { error: NextResponse.json({ error: 'Siz qavat sardori emassiz' }, { status: 403 }) } as const
  }

  if (permission && !can(caller.captain_permissions, permission)) {
    return {
      error: NextResponse.json(
        { error: 'Bu bo‘lim uchun dekan ruxsat bermagan', code: 'PERMISSION_REVOKED' },
        { status: 403 },
      ),
    } as const
  }

  // A sardor's scope is one faculty's building. Missing / unrecognised
  // faculty fails closed — never silently widens to the primary building.
  const faculty = normalizeFaculty(caller.faculty)
  if (!faculty) {
    return { error: NextResponse.json({ error: 'Fakultet biriktirilmagan' }, { status: 403 }) } as const
  }

  return { caller: caller as FloorCaptain, serviceSupabase, faculty } as const
}
