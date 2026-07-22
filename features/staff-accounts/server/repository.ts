import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import { createAuthUserSafely, deleteAuthUserSafely } from '@/lib/supabase-admin-auth'
import type { ManagedStaffRole } from '../types'

export function createStaffAccountRepository() {
  const supabase = getServiceSupabase()
  return {
    async list() {
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name, email, role, status, phone_number, assigned_floor, assigned_gender, created_at')
        .in('role', ['admin', 'tarbiyachi'])
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
    }) {
      return supabase.from('staff').insert(row)
    },
    async deleteAuthUser(id: string) {
      return deleteAuthUserSafely(id)
    },
  }
}

export type StaffAccountRepository = ReturnType<typeof createStaffAccountRepository>
