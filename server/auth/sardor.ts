import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { getRequestUser } from '@/lib/server-auth'

export type FloorCaptain = {
  id: string
  full_name: string | null
  role: string
  status: string | null
  is_floor_captain: boolean | null
  assigned_floor: number | null
  gender: string | null
  faculty: string | null
}

// Every /api/sardor/* route requires the caller to be an active, active
// floor-captain student, scoped to the resident/announcement rows for their
// own assigned_floor + gender. This was previously hand-rolled per handler.
export async function requireFloorCaptain(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user?.id) {
    return { error: NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 }) } as const
  }

  const serviceSupabase = getServiceSupabase()
  const { data: caller, error } = await serviceSupabase
    .from('users')
    .select('id, full_name, role, status, is_floor_captain, assigned_floor, gender, faculty')
    .eq('id', user.id)
    .maybeSingle()

  if (error || !caller || caller.role !== 'talaba' || caller.status !== 'active' || !caller.is_floor_captain) {
    return { error: NextResponse.json({ error: 'Siz qavat sardori emassiz' }, { status: 403 }) } as const
  }

  return { caller: caller as FloorCaptain, serviceSupabase } as const
}
