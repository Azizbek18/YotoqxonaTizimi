import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { Json } from '@/types/database.generated'

export function createCleaningScheduleRepository() {
  const supabase = getServiceSupabase()
  return {
    async getRoomNumber(studentId: string) {
      const { data, error } = await supabase
        .from('users')
        .select('room_number')
        .eq('id', studentId)
        .eq('role', 'talaba')
        .maybeSingle()
      if (error) throw error
      return data?.room_number ?? null
    },
    async get(roomNumber: string) {
      const { data, error } = await supabase
        .from('cleaning_schedule')
        .select('schedule, updated_at')
        .eq('room_number', roomNumber)
        .maybeSingle()
      if (error) throw error
      return data
    },
    async save(roomNumber: string, schedule: Json) {
      const { data, error } = await supabase
        .from('cleaning_schedule')
        .upsert({ room_number: roomNumber, schedule, updated_at: new Date().toISOString() }, { onConflict: 'room_number' })
        .select('schedule, updated_at')
        .single()
      if (error) throw error
      return data
    },
  }
}

export type CleaningScheduleRepository = ReturnType<typeof createCleaningScheduleRepository>
