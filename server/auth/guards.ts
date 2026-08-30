import 'server-only'
import type { User } from '@supabase/supabase-js'
import { getRequestUser } from '@/lib/server-auth'
import { getServiceSupabase } from '@/lib/server-supabase'
import { ApiError } from '@/server/http/api-error'
import { readSuperadminScope } from './faculty'
import { isActiveStaff, isActiveStudent, type AppRole } from './policies'

type StudentIdentity = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  status: string | null
  faculty: string | null
}

type StaffIdentity = {
  id: string
  full_name: string
  email: string
  role: string
  status: string | null
  faculty: string | null
  /**
   * `admin` role only: true when the superadmin is acting cross-faculty
   * (sa_scope cookie is `*` / unset). When they've picked one faculty,
   * `faculty` is overwritten with it and this stays false, so every
   * downstream `staff.faculty` consumer just works "as that faculty".
   */
  superadminGlobal?: boolean
}

export async function requireUser(request?: Request): Promise<User> {
  const user = await getRequestUser(request)
  if (!user?.id) throw new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED')
  return user
}

export async function requireActiveStudent(request?: Request) {
  const user = await requireUser(request)
  const { data: student, error } = await getServiceSupabase()
    .from('users')
    .select('id, full_name, email, role, status, faculty')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new ApiError(500, 'Talaba profilini tekshirib bo‘lmadi')
  if (!isActiveStudent(student)) {
    throw new ApiError(403, 'Faol talaba profili talab qilinadi', 'FORBIDDEN')
  }

  return { user, student: student as StudentIdentity }
}

export async function requireActiveStaff(
  request: Request | undefined,
  allowedRoles: readonly Exclude<AppRole, 'talaba'>[],
) {
  const user = await requireUser(request)
  const { data: staff, error } = await getServiceSupabase()
    .from('staff')
    .select('id, full_name, email, role, status, faculty')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw new ApiError(500, 'Xodim profilini tekshirib bo‘lmadi')
  if (!isActiveStaff(staff, allowedRoles)) {
    throw new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN')
  }

  const identity = staff as StaffIdentity
  // Superadmin scope injection: an `admin` who has picked a faculty in the
  // sidebar acts as that faculty everywhere; global mode leaves `faculty`
  // untouched and flags `superadminGlobal` for the routes that aggregate.
  if (identity.role === 'admin') {
    const scope = await readSuperadminScope()
    if (scope === 'global') identity.superadminGlobal = true
    else identity.faculty = scope.faculty
  }

  return { user, staff: identity }
}

export function requireAdmin(request?: Request) {
  return requireActiveStaff(request, ['admin'])
}
