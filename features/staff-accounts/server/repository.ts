import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import { createAuthUserSafely, deleteAuthUserSafely } from '@/lib/supabase-admin-auth'
import type { ManagedStaffRole } from '../types'

export function createStaffAccountRepository() {
  const supabase = getServiceSupabase()
  return {
    // Scoped to one faculty's tarbiyachi accounts. Legacy rows created
    // before faculty scoping have no faculty yet and stay visible to
    // whoever manages this list until Bosqich 3 assigns them.
    async listAll(faculty: string) {
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name, email, role, status, phone_number, assigned_floor, assigned_gender, created_at, faculty')
        .eq('role', 'tarbiyachi')
        .or(`faculty.eq.${faculty},faculty.is.null`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    async findByEmail(email: string) {
      const { data, error } = await supabase.from('staff').select('id').eq('email', email).maybeSingle()
      if (error) throw error
      return data
    },
    async createAuthUser(email: string, password: string, role: ManagedStaffRole) {
      return createAuthUserSafely(email, password, { role })
    },
    async insertStaffRow(row: {
      id: string
      email: string
      full_name: string
      phone_number: string | null
      role: ManagedStaffRole
      status: 'active'
      faculty: string
      assigned_floor: number | null
      assigned_gender: 'male' | 'female' | null
      created_by: string
    }) {
      return supabase.from('staff').insert(row)
    },
    async deleteAuthUser(id: string) {
      return deleteAuthUserSafely(id)
    },
  }
}

export type StaffAccountRepository = ReturnType<typeof createStaffAccountRepository>
