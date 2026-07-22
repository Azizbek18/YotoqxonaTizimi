import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { UserRow } from '@/types/database.generated'

const PROFILE_COLUMNS = 'id, full_name, middle_name, email, phone_number, faculty, direction, role, status, room_number, course, group, gender, nationality, region, district, mahalla, study_type, entry_date, passport_series, passport_date, birth_date, father_full_name, father_workplace, father_phone, mother_full_name, mother_workplace, mother_phone, avatar_url, warning_count, assigned_floor, is_floor_captain, created_at'
const ROOMMATE_COLUMNS = 'id, full_name, email, phone_number, faculty, role, room_number, course, group, avatar_url'

export function createProfileRepository() {
  const supabase = getServiceSupabase()
  return {
    async findStudent(studentId: string) {
      const { data, error } = await supabase
        .from('users')
        .select(PROFILE_COLUMNS)
        .eq('id', studentId)
        .eq('role', 'talaba')
        .maybeSingle()
      if (error) throw error
      return data
    },

    async listRoommates(studentId: string, roomNumber: string) {
      const { data, error } = await supabase
        .from('users')
        .select(ROOMMATE_COLUMNS)
        .eq('role', 'talaba')
        .eq('status', 'active')
        .eq('room_number', roomNumber)
        .neq('id', studentId)
        .order('full_name', { ascending: true })
      if (error) throw error
      return data ?? []
    },

    async findFloorCaptain(floor: number, gender: string) {
      const { data, error } = await supabase
        .from('users')
        .select('full_name, phone_number, email')
        .eq('role', 'talaba')
        .eq('status', 'active')
        .eq('is_floor_captain', true)
        .eq('assigned_floor', floor)
        .eq('gender', gender)
        .maybeSingle()
      if (error) throw error
      return data
    },

    async updateStudent(studentId: string, updates: Partial<UserRow>) {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', studentId)
        .eq('role', 'talaba')
        .select('id, full_name, phone_number, group, faculty, room_number, avatar_url')
        .maybeSingle()
      if (error) throw error
      return data
    },
  }
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>
