import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

const SAMPLE = 8

export function createDataIntegrityRepository() {
  const supabase = getServiceSupabase()

  return {
    // Housed students whose floor was never resolved — they fall out of
    // floor-scoped views (sardor lists, floor announcements).
    async roomWithoutFloor() {
      const { data, error, count } = await supabase
        .from('users')
        .select('id, full_name, faculty', { count: 'exact' })
        .eq('role', 'talaba')
        .not('room_number', 'is', null)
        .is('assigned_floor', null)
        .limit(SAMPLE)
      if (error) throw error
      return { rows: data ?? [], count: count ?? 0 }
    },

    // Approved permits that never turned into a registration.
    async staleApprovedPermits(cutoffIso: string) {
      const { data, error, count } = await supabase
        .from('permit_requests')
        .select('id, full_name, faculty, created_at', { count: 'exact' })
        .eq('status', 'approved')
        .lt('created_at', cutoffIso)
        .order('created_at', { ascending: true })
        .limit(SAMPLE)
      if (error) throw error
      return { rows: data ?? [], count: count ?? 0 }
    },

    async frozenRooms() {
      const { data, error } = await supabase
        .from('floor_room_layout')
        .select('room_number, faculty')
        .eq('frozen', true)
      if (error) throw error
      return data ?? []
    },

    async layoutRoomNumbers() {
      const { data, error } = await supabase
        .from('floor_room_layout')
        .select('room_number, faculty')
      if (error) throw error
      return data ?? []
    },

    // TODO(scale): unbounded — fine for the current dataset (~hundreds of
    // residents), move to a targeted query once a building exceeds ~1000.
    async housedStudents() {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, faculty, room_number')
        .eq('role', 'talaba')
        .not('room_number', 'is', null)
      if (error) throw error
      return data ?? []
    },

    async allStudentFaculties() {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, faculty')
        .eq('role', 'talaba')
      if (error) throw error
      return data ?? []
    },

    async pendingPermitFaculties() {
      const { data, error } = await supabase
        .from('permit_requests')
        .select('faculty')
        .eq('status', 'pending')
      if (error) throw error
      return (data ?? []).map((r) => String(r.faculty ?? ''))
    },

    async activeDeanFaculties() {
      const { data, error } = await supabase
        .from('staff')
        .select('faculty')
        .eq('role', 'dekan')
        .eq('status', 'active')
      if (error) throw error
      return (data ?? []).map((r) => String(r.faculty ?? ''))
    },
  }
}

export type DataIntegrityRepository = ReturnType<typeof createDataIntegrityRepository>
export { SAMPLE }
