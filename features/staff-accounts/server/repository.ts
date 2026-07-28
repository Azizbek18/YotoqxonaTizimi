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
      // zamdekan's tarbiyachi roster, including contact info). Rows from
      // before created_by existed have it NULL (SQL NULL never equals
      // creatorId), so those are included via an explicit "or is null"
      // rather than becoming permanently invisible to every zamdekan.
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name, email, role, status, phone_number, assigned_floor, assigned_gender, created_at')
        .eq('role', 'tarbiyachi')
        .or(`created_by.eq.${creatorId},created_by.is.null`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    async findByEmail(email: string) {
      const { data, error } = await supabase.from('staff').select('id').eq('email', email).maybeSingle()
      if (error) throw error
      return data
    },
    // Floors house students from every faculty (dorms aren't faculty-
    // segregated), so this can't fully scope a tarbiyachi to one faculty —
    // but it does stop a zamdekan from picking a floor with zero
    // connection to their own faculty at all.
    async floorHasFacultyStudents(floor: number, faculty: string) {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'talaba')
        .eq('assigned_floor', floor)
        .ilike('faculty', faculty)
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return Boolean(data)
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
