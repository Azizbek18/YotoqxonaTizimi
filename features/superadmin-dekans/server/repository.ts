import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import { fetchAllSupabaseRows } from '@/lib/server-supabase-pagination'

type DekanRow = { id: string; full_name: string; email: string; phone_number: string | null; faculty: string | null; status: string | null; created_at: string }
type EducatorRow = { faculty: string | null; status: string | null }
type StudentRow = { faculty: string | null; status: string | null; room_number: string | null }
type PermitRow = { faculty: string | null; status: string | null; room_number: string | null }
type FacultyDormRow = { faculty: string; dorm_id: string }
type DormRow = { id: string; number: string; name: string; default_room_capacity: number }
type RoomRow = { faculty: string | null; room_number: string; frozen: boolean; capacity: number | null }

export function createSuperadminDekanRepository() {
  const supabase = getServiceSupabase()

  return {
    async loadAll() {
      const [dekans, educators, students, permits, facultyDorms, dorms, rooms] = await Promise.all([
        fetchAllSupabaseRows<DekanRow>((from, to) => supabase
          .from('staff')
          .select('id, full_name, email, phone_number, faculty, status, created_at')
          .eq('role', 'dekan')
          .order('created_at', { ascending: false })
          .range(from, to)),
        fetchAllSupabaseRows<EducatorRow>((from, to) => supabase
          .from('staff')
          .select('faculty, status')
          .eq('role', 'tarbiyachi')
          .range(from, to)),
        fetchAllSupabaseRows<StudentRow>((from, to) => supabase
          .from('users')
          .select('faculty, status, room_number')
          .eq('role', 'talaba')
          .range(from, to)),
        fetchAllSupabaseRows<PermitRow>((from, to) => supabase
          .from('permit_requests')
          .select('faculty, status, room_number')
          .range(from, to)),
        fetchAllSupabaseRows<FacultyDormRow>((from, to) => supabase
          .from('faculty_dorm')
          .select('faculty, dorm_id')
          .range(from, to)),
        fetchAllSupabaseRows<DormRow>((from, to) => supabase
          .from('dorms')
          .select('id, number, name, default_room_capacity')
          .range(from, to)),
        fetchAllSupabaseRows<RoomRow>((from, to) => supabase
          .from('floor_room_layout')
          .select('faculty, room_number, frozen, capacity')
          .range(from, to)),
      ])
      return { dekans, educators, students, permits, facultyDorms, dorms, rooms }
    },

    // ---- dean lifecycle (superadmin mutations) ----

    async getDekan(id: string) {
      const { data, error } = await supabase
        .from('staff')
        .select('id, full_name, email, faculty, status')
        .eq('id', id)
        .eq('role', 'dekan')
        .maybeSingle()
      if (error) throw error
      return data
    },

    // An active dean already sitting on this faculty (optionally ignoring one
    // row, so a no-op reassign of the same dean doesn't collide with itself).
    async activeDekanFor(faculty: string, exceptId?: string) {
      let query = supabase
        .from('staff')
        .select('id, full_name')
        .eq('role', 'dekan')
        .eq('status', 'active')
        .ilike('faculty', faculty)
      if (exceptId) query = query.neq('id', exceptId)
      const { data, error } = await query.maybeSingle()
      if (error) throw error
      return data
    },

    async updateDekan(id: string, patch: { status?: string; faculty?: string }) {
      const { data, error } = await supabase
        .from('staff')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('role', 'dekan')
        .select('id, full_name, faculty, status')
        .maybeSingle()
      if (error) throw error
      return data
    },
  }
}

export type SuperadminDekanRepository = ReturnType<typeof createSuperadminDekanRepository>
