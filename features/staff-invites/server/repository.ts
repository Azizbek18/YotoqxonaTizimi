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

    // Cross-faculty — the superadmin manages every faculty's dean invites.
    async listByRole(role: StaffInviteRole) {
      const { data, error } = await supabase
        .from('staff_invites')
        .select(COLUMNS)
        .eq('role', role)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },

    // Does this faculty already have an active dean? The DB enforces one
    // (staff_one_active_dekan_per_faculty), but the superadmin UI checks up
    // front so it doesn't offer "invite" for a covered faculty.
    async activeDekanExists(faculty: string) {
      const { data, error } = await supabase
        .from('staff')
        .select('id')
        .eq('role', 'dekan')
        .eq('status', 'active')
        .ilike('faculty', faculty)
        .maybeSingle()
      if (error) throw error
      return Boolean(data)
    },

    // A still-usable code for this email in ANY faculty (the
    // staff_invites_one_pending_per_email index is global, not per faculty).
    async pendingInviteForEmailAnywhere(email: string) {
      const { data, error } = await supabase
        .from('staff_invites')
        .select('id')
        .ilike('email', email)
        .is('revoked_at', null)
        .eq('use_count', 0)
        .maybeSingle()
      if (error) throw error
      return data
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

    // Superadmin — revoke a dean invite regardless of faculty.
    async revokeAnyDean(id: string) {
      const { data, error } = await supabase
        .from('staff_invites')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', id)
        .eq('role', 'dekan')
        .is('revoked_at', null)
        .select('id')
        .maybeSingle()
      if (error) throw error
      return data
    },
  }
}

export type StaffInviteRepository = ReturnType<typeof createStaffInviteRepository>
