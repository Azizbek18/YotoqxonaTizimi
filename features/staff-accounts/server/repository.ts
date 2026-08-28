import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

const COLUMNS = 'id, full_name, email, role, status, phone_number, assigned_floor, assigned_gender, created_at, faculty'

export function createStaffAccountRepository() {
  const supabase = getServiceSupabase()
  return {
    // Scoped to one faculty's tarbiyachi accounts. Legacy rows created
    // before faculty scoping have no faculty yet and stay visible to
    // whoever manages this list until they are assigned one.
    async listAll(faculty: string) {
      const { data, error } = await supabase
        .from('staff')
        .select(COLUMNS)
        .eq('role', 'tarbiyachi')
        .or(`faculty.eq.${faculty},faculty.is.null`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  }
}

export type StaffAccountRepository = ReturnType<typeof createStaffAccountRepository>
