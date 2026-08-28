import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { StaffInviteRole } from '../types'

const COLUMNS = 'id, faculty, role, email, label, created_at, expires_at, revoked_at, max_uses, use_count'

export function createStaffInviteRepository() {
  const supabase = getServiceSupabase()
  return {
    async listByFaculty(faculty: string) {
      const { data, error } = await supabase
        .from('staff_invites')
        .select(COLUMNS)
        .eq('faculty', faculty)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },

    // Whether some staff account already uses this email — a code for it
    // would be dead on arrival (claim_staff_invite rejects it too).
    async staffEmailExists(email: string) {
      const { data, error } = await supabase
        .from('staff')
        .select('id')
        .ilike('email', email)
        .maybeSingle()
      if (error) throw error
      return Boolean(data)
    },

    // A still-usable code already issued for this email in this faculty.
    async pendingInviteForEmail(faculty: string, email: string) {
      const { data, error } = await supabase
        .from('staff_invites')
        .select('id')
        .eq('faculty', faculty)
        .ilike('email', email)
        .is('revoked_at', null)
        .eq('use_count', 0)
        .maybeSingle()
      if (error) throw error
      return data
    },

    async insert(row: {
      code_hash: string
      faculty: string
      role: StaffInviteRole
      email: string
      label: string | null
      created_by: string
      expires_at: string
      max_uses: number | null
    }) {
      const { data, error } = await supabase.from('staff_invites').insert(row).select(COLUMNS).single()
      if (error) throw error
      return data
    },

    // Scoped to the faculty so a dekan can only revoke their own invites.
    async revoke(id: string, faculty: string) {
      const { data, error } = await supabase
        .from('staff_invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)
        .eq('faculty', faculty)
        .is('revoked_at', null)
        .select('id')
        .maybeSingle()
      if (error) throw error
      return data
    },
  }
}

export type StaffInviteRepository = ReturnType<typeof createStaffInviteRepository>
