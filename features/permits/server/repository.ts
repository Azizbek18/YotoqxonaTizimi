import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import { deleteAuthUserSafely } from '@/lib/supabase-admin-auth'

export function createPermitAdminRepository() {
  const supabase = getServiceSupabase()
  return {
    // Everything the dekan overview needs, scoped to ONE faculty at the
    // source. Since the multi-faculty migration each faculty owns its own
    // building (floor_room_layout.faculty) and room assignment locks per
    // (faculty, room_number) — so occupancy really is per-faculty now, and
    // a dekan never sees another building's rows (not even redacted).
    async load(faculty: string) {
      const [permitsResult, usersResult] = await Promise.all([
        supabase
          .from('permit_requests')
          .select('*')
          .ilike('faculty', faculty)
          .order('created_at', { ascending: false }),
        supabase
          .from('users')
          .select('id, full_name, passport_series, jshshir, phone_number, gender, faculty, direction, course, room_number, warning_count, blacklisted, role, status')
          .eq('role', 'talaba')
          .ilike('faculty', faculty),
      ])
      if (permitsResult.error) throw permitsResult.error
      if (usersResult.error) throw usersResult.error
      return { permits: permitsResult.data ?? [], users: usersResult.data ?? [] }
    },
    async find(id: string) {
      const { data, error } = await supabase.from('permit_requests').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },
    async update(id: string, updates: { status: string; room_number: string | null; reject_reason: string | null }) {
      const { data, error } = await supabase
        .from('permit_requests')
        .update(updates)
        .eq('id', id)
        .eq('status', 'pending')
        .select()
        .maybeSingle()
      if (error) throw error
      return data
    },
    // Any talaba account keyed to this permit's identity. Imtiyozli
    // applications have no JShSHIR, so passport_series alone must still
    // match; a government yo'llanma has both. Two plain equality queries
    // rather than a single `.or()` — the values (foreign ID numbers can
    // carry spaces/hyphens) never touch PostgREST's filter-string parser
    // this way.
    async findLinkedUser(passportSeries: string | null, jshshir: string | null) {
      const passport = (passportSeries ?? '').trim()
      const jshshirValue = (jshshir ?? '').trim()
      const columns = 'id, role, status, faculty'
      if (passport) {
        const { data, error } = await supabase
          .from('users').select(columns).eq('role', 'talaba').eq('passport_series', passport).limit(1)
        if (error) throw error
        if (data?.[0]) return data[0]
      }
      if (jshshirValue) {
        const { data, error } = await supabase
          .from('users').select(columns).eq('role', 'talaba').eq('jshshir', jshshirValue).limit(1)
        if (error) throw error
        if (data?.[0]) return data[0]
      }
      return null
    },
    // Removes a not-yet-verified (status='pending') student account created
    // by a premature self-registration, so the dekan can still undo the
    // approval it was made against. Auth account first, profile row second —
    // same ordering and reasoning as app/api/admin/users DELETE. The status
    // guard means a race with email verification loses safely (no-op)
    // rather than deleting a now-active student.
    async deletePendingStudent(id: string) {
      const { error: authError } = await deleteAuthUserSafely(id)
      if (authError && !/not.*found|does not exist/i.test(authError.message ?? '')) {
        throw authError
      }
      const { error } = await supabase.from('users').delete().eq('id', id).eq('status', 'pending')
      if (error) throw error
    },
    // Reverts an approved permit to the pending queue and drops any
    // pre-reserved room. The status guard makes a double-submit or a race
    // with a concurrent registration a no-op rather than a silent stomp.
    async cancelApproval(id: string) {
      const { data, error } = await supabase
        .from('permit_requests')
        .update({ status: 'pending', room_number: null, reject_reason: null })
        .eq('id', id)
        .eq('status', 'approved')
        .select()
        .maybeSingle()
      if (error) throw error
      return data
    },
  }
}

export type PermitAdminRepository = ReturnType<typeof createPermitAdminRepository>
