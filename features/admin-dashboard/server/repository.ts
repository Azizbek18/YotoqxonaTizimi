import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

export function createAdminDashboardRepository() {
  const supabase = getServiceSupabase()
  return {
    async load() {
      const [usersResult, staffResult, applicationsResult] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('staff').select('id, role'),
        supabase.from('arizalar').select('created_at, status, type'),
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
