import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { StudentScope, StudentWarningLevel } from '../types'

const STUDENT_PROFILE_COLUMNS =
  'id, full_name, middle_name, email, phone_number, avatar_url, gender, faculty, direction, course, status, room_number, assigned_floor, is_floor_captain, is_council_chair, warning_count, blacklisted, birth_date, nationality, country, study_type, entry_date, region, district, mahalla, passport_series, jshshir, passport_date, father_full_name, father_workplace, father_phone, mother_full_name, mother_workplace, mother_phone, created_at'

export function createFacultyStudentsRepository() {
  const supabase = getServiceSupabase()
  return {
    // status='active' excludes accounts that registered but never verified
    // their email, in every scope.
    async listStudentProfiles(faculty: string, scope: StudentScope) {
      let query = supabase
        .from('users')
        .select(`${STUDENT_PROFILE_COLUMNS}, dorm_id, block`)
        .eq('role', 'talaba')
        .eq('status', 'active')
        .eq('is_off_campus', false)
        .ilike('faculty', faculty)
      if (scope === 'placed') query = query.not('room_number', 'is', null)
      if (scope === 'roomless') query = query.is('room_number', null)
      const { data, error } = await query.order('full_name', { ascending: true })
      if (error) throw error
      return data ?? []
    },

    // Signed tushuntirish xatlari per student, for the red 3-letter flag. A
    // letter leaves 'draft' only once its signature exists, so != 'draft'
    // means signed. One query for the faculty, counted in memory.
    async explanationCountsByStudent(faculty: string): Promise<Map<string, number>> {
      const { data, error } = await supabase
        .from('arizalar')
        .select('student_id')
        .eq('type', 'tushuntirish')
        .neq('status', 'draft')
        .ilike('faculty', faculty)
      if (error) throw error
      const counts = new Map<string, number>()
      for (const row of data ?? []) {
        if (row.student_id) counts.set(row.student_id, (counts.get(row.student_id) ?? 0) + 1)
      }
      return counts
    },

    // Approved yo'llanmalar nobody has registered from yet. A permit is
    // "registered" once a users row shares its passport_series or JSHSHIR
    // (both unique) — same match the dashboard occupancy count uses. Includes
    // permits that already hold a room: those are beds in use that the
    // registered-students list cannot show.
    async listUnregisteredApprovedPermits(faculty: string) {
      const [permitsResult, usersResult] = await Promise.all([
        supabase
          .from('permit_requests')
          .select('id, full_name, gender, phone, email, direction, course, application_type, room_number, dorm_id, block, assigned_floor, passport_series, jshshir, created_at')
          .eq('status', 'approved')
          .ilike('faculty', faculty)
          .order('full_name', { ascending: true }),
        supabase
          .from('users')
          .select('passport_series, jshshir')
          .eq('role', 'talaba')
          .ilike('faculty', faculty),
      ])
      if (permitsResult.error) throw permitsResult.error
      if (usersResult.error) throw usersResult.error
      const passports = new Set((usersResult.data ?? []).map((u) => u.passport_series).filter(Boolean))
      const jshshirs = new Set((usersResult.data ?? []).map((u) => u.jshshir).filter(Boolean))
      return (permitsResult.data ?? [])
        .filter((p) => !(p.passport_series && passports.has(p.passport_series))
          && !(p.jshshir && jshshirs.has(p.jshshir)))
        .map((p) => ({
          id: p.id, full_name: p.full_name, gender: p.gender, phone: p.phone, email: p.email,
          direction: p.direction, course: p.course, application_type: p.application_type,
          room_number: p.room_number, dorm_id: p.dorm_id, block: p.block,
          assigned_floor: p.assigned_floor, created_at: p.created_at,
        }))
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
        .eq('is_off_campus', false)
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
        .select('id, full_name, email, faculty, role, status, warning_count, blacklisted')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return data
    },

    // Bar / un-bar a student. Blacklisting frees their bed too — room,
    // floor and captaincy are cleared in the same write so the room map
    // and the "Sardorlar" list don't keep showing a removed resident.
    async setBlacklist(id: string, blacklisted: boolean) {
      const updates = blacklisted
        ? { blacklisted, room_number: null, assigned_floor: null, is_floor_captain: false, is_council_chair: false }
        : { blacklisted }
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .eq('role', 'talaba')
        .select('id, blacklisted')
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
