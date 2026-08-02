import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { StudentScope, StudentWarningLevel } from '../types'

const STUDENT_PROFILE_COLUMNS =
  'id, full_name, middle_name, email, phone_number, avatar_url, gender, faculty, direction, course, status, room_number, assigned_floor, is_floor_captain, warning_count, birth_date, nationality, study_type, entry_date, region, district, mahalla, passport_series, jshshir, passport_date, father_full_name, father_workplace, father_phone, mother_full_name, mother_workplace, mother_phone, created_at'

export function createFacultyStudentsRepository() {
  const supabase = getServiceSupabase()
  return {
    // status='active' excludes accounts that registered but never verified
    // their email, in every scope.
    async listStudentProfiles(faculty: string, scope: StudentScope) {
      let query = supabase
        .from('users')
        .select(STUDENT_PROFILE_COLUMNS)
        .eq('role', 'talaba')
        .eq('status', 'active')
        .ilike('faculty', faculty)
      if (scope === 'placed') query = query.not('room_number', 'is', null)
      if (scope === 'roomless') query = query.is('room_number', null)
      const { data, error } = await query.order('full_name', { ascending: true })
      if (error) throw error
      return data ?? []
    },

    // Every active student of the faculty, id column only — the payments
    // endpoint just needs an id set to filter `tolovlar` by, and a student
    // who paid before being assigned a room still has to be covered.
    async listFacultyStudentIds(faculty: string) {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'talaba')
        .eq('status', 'active')
        .ilike('faculty', faculty)
      if (error) throw error
      return (data ?? []).map((row) => String(row.id))
    },

    async listPayments(studentIds: string[]) {
      const { data, error } = await supabase
        .from('tolovlar')
        .select('id, student_id, month, year, amount, status, admin_message, receipt_url, created_at')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },

    async findStudent(id: string) {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, faculty, role, status, warning_count')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },

    // Inserting the arizalar row and re-deriving users.warning_count happen
    // inside one transaction (see 202607300000) so a concurrent second
    // warning can't read a stale count, and so a half-applied warning
    // (row without count, or count without row) is impossible.
    async createWarningAtomic(studentId: string, title: string, text: string, level: StudentWarningLevel) {
      const { data, error } = await supabase.rpc('create_student_warning_atomic', {
        p_student_id: studentId,
        p_title: title,
        p_text: text,
        p_level: level,
      })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return (row ?? null) as { warning_id: string; new_warning_count: number } | null
    },
  }
}

export type FacultyStudentsRepository = ReturnType<typeof createFacultyStudentsRepository>
