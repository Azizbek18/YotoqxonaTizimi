import 'server-only'
import type { User } from '@supabase/supabase-js'
import { getRequestUser } from '@/lib/server-auth'
import { getServiceSupabase } from '@/lib/server-supabase'
import { ApiError } from '@/server/http/api-error'
import { isActiveStaff, isActiveStudent, type AppRole } from './policies'

type StudentIdentity = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  status: string | null
}

type StaffIdentity = {
  id: string
  full_name: string
  email: string
  role: string
  status: string | null
  faculty: string | null
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
    .select('id, full_name, email, role, status')
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

  return { user, staff: staff as StaffIdentity }
}

export function requireAdmin(request?: Request) {
  return requireActiveStaff(request, ['admin'])
}
