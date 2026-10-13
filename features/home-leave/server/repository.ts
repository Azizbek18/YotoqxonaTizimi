import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { HomeLeaveRow } from '@/types/database.generated'
import type { PostLeaveRecord } from '../domain'

type LeaveStatusValue = HomeLeaveRow['status']
type LeavePatch = Partial<HomeLeaveRow>

const COLUMNS =
  'id, student_id, destination_kind, destination_address, destination_lat, destination_lng, contact_name, contact_phone, reason, starts_on, ends_on, status, consented_at, loc_status, loc_lat, loc_lng, loc_at, call_result, call_by_name, call_at, decided_by, decided_by_name, decided_at, decision_note, returned_at, created_at'

const STUDENT_COLUMNS = 'id, full_name, room_number, assigned_floor, gender, faculty, dorm_id, block, status, is_off_campus'

export type LeaveStudent = {
  id: string
  full_name: string | null
  room_number: string | null
  assigned_floor: number | null
  gender: string | null
  faculty: string | null
  dorm_id: string | null
  block: string | null
  status: string | null
  is_off_campus: boolean | null
}

export type LeaveWithStudent = HomeLeaveRow & { users: LeaveStudent | null }

export type LeaveScope = {
  dormId: string
  faculties: string[]
  floor?: number | null
  gender?: string | null
  block?: string | null
}

export function createHomeLeaveRepository() {
  const supabase = getServiceSupabase()
  return {
    async findStudent(studentId: string): Promise<LeaveStudent | null> {
      const { data, error } = await supabase
        .from('users')
        .select(STUDENT_COLUMNS)
        .eq('id', studentId)
        .eq('role', 'talaba')
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as LeaveStudent | null
    },

    async listForStudent(studentId: string): Promise<HomeLeaveRow[]> {
      const { data, error } = await supabase
        .from('home_leaves')
        .select(COLUMNS)
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data ?? []) as unknown as HomeLeaveRow[]
    },

    async getById(id: string): Promise<LeaveWithStudent | null> {
      const { data, error } = await supabase
        .from('home_leaves')
        .select(`${COLUMNS}, users!inner(${STUDENT_COLUMNS})`)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as unknown as LeaveWithStudent | null
    },

    /** Talabaning hali tugamagan (pending/active) arizalari — ustma-ust tushmasin. */
    async openForStudent(studentId: string, today: string): Promise<HomeLeaveRow[]> {
      const { data, error } = await supabase
        .from('home_leaves')
        .select(COLUMNS)
        .eq('student_id', studentId)
        .in('status', ['pending', 'active'])
        .gte('ends_on', today)
      if (error) throw error
      return (data ?? []) as unknown as HomeLeaveRow[]
    },

    /** Oldin shubhali bo'lgan ketish: aloqa shaxsi inkor qilgan yoki joylashuv mos kelmagan. */
    async hadSuspicious(studentId: string): Promise<boolean> {
      const { count, error } = await supabase
        .from('home_leaves')
        .select('id', { count: 'exact', head: true })
        .eq('student_id', studentId)
        .or('call_result.eq.denied,loc_status.eq.far')
      if (error) throw error
      return (count ?? 0) > 0
    },

    async insert(studentId: string, fields: Omit<LeavePatch, 'student_id'>): Promise<HomeLeaveRow> {
      const { data, error } = await supabase
        .from('home_leaves')
        .insert({ student_id: studentId, ...fields })
        .select(COLUMNS)
        .single()
      if (error) throw error
      return data as unknown as HomeLeaveRow
    },

    /** Faqat `from` holatlaridan biridagi qatorni yangilaydi (poyga holatlariga qarshi). */
    async update(id: string, from: LeaveStatusValue[], fields: LeavePatch): Promise<HomeLeaveRow | null> {
      const { data, error } = await supabase
        .from('home_leaves')
        .update(fields)
        .eq('id', id)
        .in('status', from)
        .select(COLUMNS)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as unknown as HomeLeaveRow | null
    },

    /** Qo'ng'iroq / joylashuv natijasi — holatga tegmaydi. */
    async patchMeta(id: string, fields: LeavePatch): Promise<HomeLeaveRow | null> {
      const { data, error } = await supabase
        .from('home_leaves')
        .update(fields)
        .eq('id', id)
        .in('status', ['pending', 'active'])
        .select(COLUMNS)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as unknown as HomeLeaveRow | null
    },

    /** Bugun amalda "Uyda" bo'lgan talabalar (yo'qlama yozuvlarini oldindan belgilash uchun). */
    async activeStudentIds(studentIds: string[], today: string): Promise<Set<string>> {
      if (studentIds.length === 0) return new Set()
      const { data, error } = await supabase
        .from('home_leaves')
        .select('student_id')
        .in('student_id', studentIds)
        .eq('status', 'active')
        .lte('starts_on', today)
        .gte('ends_on', today)
      if (error) throw error
      return new Set((data ?? []).map((r) => (r as { student_id: string }).student_id))
    },

    /** Xodim ko'lami: shu binodagi hali tugamagan arizalar. */
    async listForScope(scope: LeaveScope, today: string): Promise<LeaveWithStudent[]> {
      let query = supabase
        .from('home_leaves')
        .select(`${COLUMNS}, users!inner(${STUDENT_COLUMNS})`)
        .eq('users.dorm_id', scope.dormId)
        .in('users.faculty', scope.faculties)
        .in('status', ['active', 'pending'])
        .gte('ends_on', today)
        .order('starts_on', { ascending: true })
        .limit(300)
      if (scope.floor != null) query = query.eq('users.assigned_floor', scope.floor)
      if (scope.gender) query = query.eq('users.gender', scope.gender)
      if (scope.block !== undefined) {
        query = scope.block ? query.eq('users.block', scope.block) : query.is('users.block', null)
      }
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as unknown as LeaveWithStudent[]
    },

    /** Dekan: fakultet talabalarining kutilayotgan va yaqinda tugagan arizalari. */
    async listForFaculty(faculty: string, today: string): Promise<LeaveWithStudent[]> {
      const { data, error } = await supabase
        .from('home_leaves')
        .select(`${COLUMNS}, users!inner(${STUDENT_COLUMNS})`)
        .ilike('users.faculty', faculty)
        .in('status', ['pending', 'active'])
        .gte('ends_on', today)
        .order('created_at', { ascending: false })
        .limit(300)
      if (error) throw error
      return (data ?? []) as unknown as LeaveWithStudent[]
    },

    /** Muddati tugagan, lekin hali "qaytdi" deb yopilmagan faol arizalar. */
    async listEnded(today: string, faculty?: string): Promise<LeaveWithStudent[]> {
      let query = supabase
        .from('home_leaves')
        .select(`${COLUMNS}, users!inner(${STUDENT_COLUMNS})`)
        .eq('status', 'active')
        .lt('ends_on', today)
        .order('ends_on', { ascending: false })
        .limit(500)
      if (faculty) query = query.ilike('users.faculty', faculty)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as unknown as LeaveWithStudent[]
    },

    /** Talabalarning `afterDate` dan keyingi yo'qlama yozuvlari (holat + sessiya holati). */
    async recordsAfter(studentIds: string[], afterDate: string): Promise<PostLeaveRecord[]> {
      const out: PostLeaveRecord[] = []
      for (let i = 0; i < studentIds.length; i += 100) {
        const { data, error } = await supabase
          .from('attendance_records')
          .select('student_id, state, attendance_sessions!inner(scheduled_for, status)')
          .in('student_id', studentIds.slice(i, i + 100))
          .gt('attendance_sessions.scheduled_for', afterDate)
        if (error) throw error
        for (const r of (data ?? []) as unknown as {
          student_id: string
          state: string
          attendance_sessions: { scheduled_for: string; status: string }
        }[]) {
          out.push({
            student_id: r.student_id,
            state: r.state,
            scheduled_for: r.attendance_sessions.scheduled_for,
            session_status: r.attendance_sessions.status,
          })
        }
      }
      return out
    },

    /** Ariza kuchga kirganda ochiq yo'qlamalardagi "belgilanmagan" yozuvni "Uyda" qiladi. */
    async markOpenSessions(studentId: string): Promise<void> {
      const { data: sessions, error: sErr } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('status', 'open')
      if (sErr) throw sErr
      const ids = (sessions ?? []).map((s) => (s as { id: string }).id)
      if (ids.length === 0) return
      const { error } = await supabase
        .from('attendance_records')
        .update({ state: 'excused', source: 'leave', soft_flag: false, marked_at: new Date().toISOString() })
        .eq('student_id', studentId)
        .eq('state', 'unmarked')
        .in('session_id', ids)
      if (error) throw error
    },

    /** Ariza tugaganda/bekor bo'lganda ochiq yo'qlamadagi "Uyda" yozuvni qaytaradi. */
    async releaseOpenSessions(studentId: string): Promise<void> {
      const { data: sessions, error: sErr } = await supabase
        .from('attendance_sessions')
        .select('id')
        .eq('status', 'open')
      if (sErr) throw sErr
      const ids = (sessions ?? []).map((s) => (s as { id: string }).id)
      if (ids.length === 0) return
      const { error } = await supabase
        .from('attendance_records')
        .update({ state: 'unmarked', source: null, marked_at: null })
        .eq('student_id', studentId)
        .eq('source', 'leave')
        .in('session_id', ids)
      if (error) throw error
    },
  }
}

export type HomeLeaveRepository = ReturnType<typeof createHomeLeaveRepository>
