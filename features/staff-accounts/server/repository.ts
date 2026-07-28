import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import { createAuthUserSafely, deleteAuthUserSafely } from '@/lib/supabase-admin-auth'
import type { ManagedStaffRole } from '../types'

export function createStaffAccountRepository() {
  const supabase = getServiceSupabase()
  return {
    async listCreatedBy(creatorId: string) {
      // Scoped to tarbiyachi accounts this specific zamdekan created —
      // never all staff building-wide (see created_by, added because a
      // zamdekan could otherwise see every admin's and every other
      // zamdekan's tarbiyachi roster, including contact info).
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name, email, role, status, phone_number, assigned_floor, assigned_gender, created_at')
        .eq('role', 'tarbiyachi')
        .eq('created_by', creatorId)
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
      assigned_floor?: number
      assigned_gender?: 'male' | 'female'
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
