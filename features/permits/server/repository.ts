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
        .select()
        .maybeSingle()
      if (error) throw error
      return data
    },
    async roomOccupancy(roomNumber: string) {
      const [users, permits] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'talaba').eq('room_number', roomNumber),
        supabase.from('permit_requests').select('id', { count: 'exact', head: true }).eq('status', 'approved').eq('room_number', roomNumber),
      ])
      if (users.error) throw users.error
      if (permits.error) throw permits.error
      return (users.count ?? 0) + (permits.count ?? 0)
    },
  }
}

export type PermitAdminRepository = ReturnType<typeof createPermitAdminRepository>
