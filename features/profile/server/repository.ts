import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { UserRow } from '@/types/database.generated'
import { normalizeFaculty } from '@/lib/faculties'

type HousingScope = Pick<UserRow, 'faculty' | 'dorm_id' | 'block' | 'assigned_floor'>

const PROFILE_COLUMNS = 'id, full_name, middle_name, email, phone_number, faculty, direction, role, status, room_number, course, group, gender, nationality, region, district, mahalla, country, study_type, entry_date, passport_series, passport_date, birth_date, father_full_name, father_workplace, father_phone, mother_full_name, mother_workplace, mother_phone, avatar_url, warning_count, assigned_floor, is_floor_captain, created_at'
const ROOMMATE_COLUMNS = 'id, full_name, email, phone_number, faculty, role, room_number, course, group, avatar_url'

export function createProfileRepository() {
  const supabase = getServiceSupabase()
  return {
    async findStudent(studentId: string) {
      const { data, error } = await supabase
        .from('users')
        .select(`${PROFILE_COLUMNS}, dorm_id, block`)
        .eq('id', studentId)
        .eq('role', 'talaba')
        .maybeSingle()
      if (error) throw error
      return data
    },

    async listRoommates(studentId: string, roomNumber: string, scope: HousingScope) {
      const faculty = normalizeFaculty(scope.faculty)
      if (!faculty || !scope.dorm_id || (scope.block && !scope.assigned_floor)) return []
      let query = supabase
        .from('users')
        .select(ROOMMATE_COLUMNS)
        .eq('role', 'talaba')
        .eq('status', 'active')
        .eq('faculty', faculty)
        .eq('dorm_id', scope.dorm_id)
        .eq('room_number', roomNumber)
        .neq('id', studentId)
        .order('full_name', { ascending: true })
      query = scope.block ? query.eq('block', scope.block).eq('assigned_floor', scope.assigned_floor!) : query.is('block', null)
      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },

    async findFloorCaptain(floor: number, gender: string, scope: HousingScope) {
      const faculty = normalizeFaculty(scope.faculty)
      if (!faculty || !scope.dorm_id) return null
      let query = supabase
        .from('users')
        .select('full_name, phone_number, email')
        .eq('role', 'talaba')
        .eq('status', 'active')
        .eq('faculty', faculty)
        .eq('dorm_id', scope.dorm_id)
        .eq('is_floor_captain', true)
        .eq('assigned_floor', floor)
        .eq('gender', gender)
      query = scope.block ? query.eq('block', scope.block) : query.is('block', null)
      const { data, error } = await query.maybeSingle()
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
