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
    async roomOccupants(roomNumber: string) {
      const [users, permits] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'talaba').eq('room_number', roomNumber),
        supabase.from('permit_requests').select('id', { count: 'exact', head: true }).eq('status', 'approved').eq('room_number', roomNumber),
      ])
      if (users.error) throw users.error
      if (permits.error) throw permits.error
      return (users.count ?? 0) + (permits.count ?? 0)
    },
    async roomGenders(roomNumber: string) {
      const [users, permits] = await Promise.all([
        supabase.from('users').select('gender').eq('role', 'talaba').eq('room_number', roomNumber),
        supabase.from('permit_requests').select('gender').eq('status', 'approved').eq('room_number', roomNumber),
      ])
      if (users.error) throw users.error
      if (permits.error) throw permits.error
      const genders = new Set<string>()
      users.data?.forEach((row) => row.gender && genders.add(row.gender))
      permits.data?.forEach((row) => row.gender && genders.add(row.gender))
      return Array.from(genders)
    },
    async updateStudentRoom(id: string, roomNumber: string | null) {
      const { error } = await supabase.from('users').update({ room_number: roomNumber }).eq('id', id)
      if (error) throw error
    },
  }
}

export type RoomAssignmentRepository = ReturnType<typeof createRoomAssignmentRepository>
