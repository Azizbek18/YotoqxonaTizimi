import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

export function createPermitAdminRepository() {
  const supabase = getServiceSupabase()
  return {
    async load() {
      const [permitsResult, usersResult] = await Promise.all([
        supabase.from('permit_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('id, full_name, passport_series, jshshir, phone_number, gender, faculty, direction, course, room_number, warning_count, blacklisted, role, status'),
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
    // match; a government yo'llanma has both.
    async findLinkedUser(passportSeries: string | null, jshshir: string | null) {
      const passport = (passportSeries ?? '').trim()
      const jshshirValue = (jshshir ?? '').trim()
      if (!passport && !jshshirValue) return null
      let query = supabase.from('users').select('id, role, status').eq('role', 'talaba')
      if (passport && jshshirValue) {
        query = query.or(`passport_series.eq.${passport},jshshir.eq.${jshshirValue}`)
      } else if (passport) {
        query = query.eq('passport_series', passport)
      } else {
        query = query.eq('jshshir', jshshirValue)
      }
      const { data, error } = await query.limit(1)
      if (error) throw error
      return data?.[0] ?? null
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
