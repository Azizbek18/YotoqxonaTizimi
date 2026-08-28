import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { StaffInviteRole } from '../types'

const COLUMNS = 'id, faculty, role, label, created_at, expires_at, revoked_at, max_uses, use_count'

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

    async insert(row: {
      code_hash: string
      faculty: string
      role: StaffInviteRole
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
