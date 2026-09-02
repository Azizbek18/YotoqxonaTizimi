import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

export function createRoomAssignmentRepository() {
  const supabase = getServiceSupabase()
  return {
    async listFacultyStudents(faculty: string) {
      // Only students without a room yet are assignable here — someone
      // already housed must be removed from their current room first
      // (see clearStudentRoom) before they can show up to be placed again.
      //
      // 'pending' (registered but email not yet verified) students are
      // included: the dekan must be able to place them onto the user row
      // directly. If we only listed 'active' ones, a pending student would
      // show up ONLY as their approved permit — and a room assigned to that
      // permit never reached the account, so the student saw no room after
      // finally verifying (fixed end-to-end by 202609230000, this keeps the
      // dekan assigning to a single, correct row).
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, gender, room_number, course, direction, status')
        .eq('role', 'talaba')
        .in('status', ['active', 'pending'])
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
      // is_floor_captain is meaningless without a floor — a captaincy has to
      // be dropped along with the room, otherwise the student lingers in the
      // "Sardorlar" list (and the sardor dashboard) with no floor to lead.
      const { error } = await supabase
        .from('users')
        .update({ room_number: null, assigned_floor: null, is_floor_captain: false })
        .eq('id', id)
      if (error) throw error
    },

    // Approved permits nobody has self-registered from yet — the other half
    // of the "roomless" queue alongside listFacultyStudents. is('room_number',
    // null) so a permit already reserved for a room (by an earlier assignment)
    // doesn't show up here a second time.
    async listApprovedUnregisteredPermits(faculty: string) {
      const { data, error } = await supabase
        .from('permit_requests')
        .select('id, full_name, gender, room_number, course, direction, passport_series')
        .eq('status', 'approved')
        .is('room_number', null)
        .ilike('faculty', faculty)
        .order('full_name', { ascending: true })
      if (error) throw error
      const permits = data ?? []
      if (permits.length === 0) return []

      // Drop permits whose person already has a users account (any status):
      // they're covered by listFacultyStudents. Otherwise the dekan sees the
      // same person twice, and assigning to the permit row leaves the
      // account roomless.
      const passports = [...new Set(permits.map((p) => p.passport_series).filter(Boolean))]
      const accounted = new Set<string>()
      if (passports.length > 0) {
        const { data: accounts, error: accountsError } = await supabase
          .from('users')
          .select('passport_series')
          .eq('role', 'talaba')
          .in('passport_series', passports)
        if (accountsError) throw accountsError
        for (const row of accounts ?? []) {
          if (row.passport_series) accounted.add(row.passport_series)
        }
      }

      return permits
        .filter((p) => !p.passport_series || !accounted.has(p.passport_series))
        .map((p) => ({
          id: p.id,
          full_name: p.full_name,
          gender: p.gender,
          room_number: p.room_number,
          course: p.course,
          direction: p.direction,
        }))
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
