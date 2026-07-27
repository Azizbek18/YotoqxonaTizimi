import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

export function createRoomAssignmentRepository() {
  const supabase = getServiceSupabase()
  return {
    async listFacultyStudents(faculty: string) {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, gender, room_number, course, direction')
        .eq('role', 'talaba')
        .ilike('faculty', faculty)
        .order('full_name', { ascending: true })
      if (error) throw error
      return data ?? []
    },
    async findStudent(id: string) {
      const { data, error } = await supabase
        .from('users')
        .select('id, faculty, gender, room_number, role')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },
    async clearStudentRoom(id: string) {
      const { error } = await supabase.from('users').update({ room_number: null, assigned_floor: null }).eq('id', id)
      if (error) throw error
    },
    // Atomically checks room capacity/gender and assigns the student inside a
    // single DB transaction (see assign_student_room_atomic in the DB
    // migration) so two concurrent zamdekan assignments to the same room
    // can't both pass a read-then-write capacity/gender check.
    async assignRoomAtomic(studentId: string, roomNumber: string) {
      const { error } = await supabase.rpc('assign_student_room_atomic', {
        p_student_id: studentId,
        p_room_number: roomNumber,
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
