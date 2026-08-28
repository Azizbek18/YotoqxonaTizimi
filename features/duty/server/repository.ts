import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import { normalizeFaculty, PRIMARY_FACULTY } from '@/lib/faculties'
import type { Json } from '@/types/database.generated'

export function createCleaningScheduleRepository() {
  const supabase = getServiceSupabase()
  return {
    // The student's room and their faculty (= their building — housing
    // faculty is the academic faculty, always). Faculty-less rows fall back
    // to the primary building.
    async getRoomAndFaculty(studentId: string) {
      const { data, error } = await supabase
        .from('users')
        .select('room_number, faculty')
        .eq('id', studentId)
        .eq('role', 'talaba')
        .maybeSingle()
      if (error) throw error
      return {
        roomNumber: data?.room_number ?? null,
        faculty: normalizeFaculty(data?.faculty ?? null) ?? PRIMARY_FACULTY,
      }
    },
    async getRoommates(faculty: string, roomNumber: string) {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'talaba')
        .eq('faculty', faculty)
        .eq('room_number', roomNumber)
        .eq('status', 'active')
      if (error) throw error
      return data ?? []
    },
    async get(faculty: string, roomNumber: string) {
      const { data, error } = await supabase
        .from('cleaning_schedule')
        .select('schedule, updated_at')
        .eq('faculty', faculty)
        .eq('room_number', roomNumber)
        .maybeSingle()
      if (error) throw error
      return data
    },
    async save(faculty: string, roomNumber: string, schedule: Json) {
      const { data, error } = await supabase
        .from('cleaning_schedule')
        .upsert(
          { faculty, room_number: roomNumber, schedule, updated_at: new Date().toISOString() },
          { onConflict: 'faculty,room_number' },
        )
        .select('schedule, updated_at')
        .single()
      if (error) throw error
      return data
    },
  }
}

export type CleaningScheduleRepository = ReturnType<typeof createCleaningScheduleRepository>
