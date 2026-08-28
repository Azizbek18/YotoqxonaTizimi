import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

export function createAdminDashboardRepository() {
  const supabase = getServiceSupabase()
  return {
    // One faculty's dashboard data. Students and applications are strictly
    // that faculty's; staff rows also, plus legacy rows with no faculty yet
    // (until Bosqich 3 assigns them).
    async load(faculty: string) {
      const [usersResult, staffResult, applicationsResult] = await Promise.all([
        supabase.from('users').select('*').eq('faculty', faculty),
        supabase.from('staff').select('id, role, faculty').or(`faculty.eq.${faculty},faculty.is.null`),
        supabase.from('arizalar').select('created_at, status, type').eq('faculty', faculty),
      ])
      if (usersResult.error) throw usersResult.error
      if (staffResult.error) throw staffResult.error
      if (applicationsResult.error) throw applicationsResult.error
      return {
        users: usersResult.data ?? [],
        staff: staffResult.data ?? [],
        applications: applicationsResult.data ?? [],
      }
    },
  }
}

export type AdminDashboardRepository = ReturnType<typeof createAdminDashboardRepository>
