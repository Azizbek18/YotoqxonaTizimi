import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

export function createRoomAssignmentRepository() {
  const supabase = getServiceSupabase()
  return {
    async listFacultyStudents(faculty: string) {
      // Only students without a room yet are assignable here — someone
      // already housed must be removed from their current room first
      // (see clearStudentRoom) before they can show up to be placed again.
      // status='active' excludes students who registered but haven't yet
      // verified their email (still 'pending'), i.e. not actually approved.
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, gender, room_number, course, direction')
        .eq('role', 'talaba')
        .eq('status', 'active')
        .ilike('faculty', faculty)
        .is('room_number', null)
        .order('full_name', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    async findStudent(id: string) {
      const { data, error } = await supabase
        .from('users')
        .select('id, faculty, gender, room_number, role, email, full_name')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    async clearStudentRoom(id: string) {
      const { error } = await supabase.from('users').update({ room_number: null, assigned_floor: null }).eq('id', id)
      if (error) throw error
    },

    // Approved permits nobody has self-registered from yet — the other half
    // of the "roomless" queue alongside listFacultyStudents. is('room_number',
    // null) so a permit already reserved for a room (by an earlier assignment)
    // doesn't show up here a second time.
    async listApprovedUnregisteredPermits(faculty: string) {
      const { data, error } = await supabase
        .from('permit_requests')
        .select('id, full_name, gender, room_number, course, direction')
        .eq('status', 'approved')
        .is('room_number', null)
        .ilike('faculty', faculty)
        .order('full_name', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    async findPermit(id: string) {
      const { data, error } = await supabase
        .from('permit_requests')
        .select('id, faculty, gender, room_number, status, full_name')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    async clearPermitRoom(id: string) {
      const { error } = await supabase
        .from('permit_requests')
        .update({ room_number: null })
        .eq('id', id)
        .eq('status', 'approved')
      if (error) throw error
    },
    // Same shape as assignRoomAtomic below, targeting the permit-side RPC
    // (see 202608270000_permit_room_preassignment.sql) instead.
    async assignPermitRoomAtomic(permitId: string, roomNumber: string, maxCapacity: number) {
      const { error } = await supabase.rpc('assign_permit_room_atomic', {
        p_permit_id: permitId,
        p_room_number: roomNumber,
        p_max_capacity: maxCapacity,
      })
      if (error) {
        if (error.code === 'P0001') return false
        throw error
      }
      return true
    },
    // Atomically checks room capacity/gender and assigns the student inside a
    // single DB transaction (see assign_student_room_atomic in the DB
    // migration) so two concurrent dekan assignments to the same room
    // can't both pass a read-then-write capacity/gender check.
    async assignRoomAtomic(studentId: string, roomNumber: string, maxCapacity: number) {
      const { error } = await supabase.rpc('assign_student_room_atomic', {
        p_student_id: studentId,
        p_room_number: roomNumber,
        p_max_capacity: maxCapacity,
      })
      if (error) {
        if (error.code === 'P0001') return false
        throw error
      }
      return true
    },
  }
}

export type RoomAssignmentRepository = ReturnType<typeof createRoomAssignmentRepository>
