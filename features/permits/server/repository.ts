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
    async roomExists(roomNumber: string) {
      const { data, error } = await supabase
        .from('floor_room_layout')
        .select('room_number')
        .eq('room_number', roomNumber)
        .maybeSingle()
      if (error) throw error
      return Boolean(data)
    },
    // Atomically checks room capacity/gender and flips status pending -> approved
    // inside a single DB transaction (see assign_room_atomic in the DB migration)
    // so two concurrent approvals for the same room can't both pass a
    // read-then-write capacity check and overbook it.
    async approveIntoRoom(id: string, roomNumber: string, maxCapacity: number) {
      const { data, error } = await supabase.rpc('approve_permit_room_atomic', {
        p_permit_id: id,
        p_room_number: roomNumber,
        p_max_capacity: maxCapacity,
      })
      if (error) {
        if (error.code === 'P0001') return null
        throw error
      }
      return Array.isArray(data) ? data[0] ?? null : data
    },
  }
}

export type PermitAdminRepository = ReturnType<typeof createPermitAdminRepository>
