import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { AttendanceRecordRow, AttendanceSessionRow } from '@/types/database.generated'
import type { AttendanceState } from '../types'

export type DormAttendanceConfig = {
  id: string
  number: string
  name: string
  floor_count: number
  latitude: number | null
  longitude: number | null
  checkin_radius_m: number
  attendance_enabled: boolean
  attendance_open_time: string
  attendance_close_time: string
}

export type ResidentRow = {
  id: string
  full_name: string | null
  avatar_url: string | null
  room_number: string | null
  assigned_floor: number | null
  gender: string | null
  faculty: string | null
}

const DORM_COLS =
  'id, number, name, floor_count, latitude, longitude, checkin_radius_m, attendance_enabled, attendance_open_time, attendance_close_time'

export function createAttendanceRepository() {
  const supabase = getServiceSupabase()

  return {
    async dormIdForFaculty(faculty: string): Promise<string | null> {
      const { data, error } = await supabase
        .from('faculty_dorm').select('dorm_id').eq('faculty', faculty).eq('is_primary', true).maybeSingle()
      if (error) throw error
      return data?.dorm_id ?? null
    },

    async facultiesForDorm(dormId: string): Promise<string[]> {
      const { data, error } = await supabase
        .from('faculty_dorm').select('faculty').eq('dorm_id', dormId)
      if (error) throw error
      return (data ?? []).map((r) => r.faculty)
    },

    async dorm(dormId: string): Promise<DormAttendanceConfig | null> {
      const { data, error } = await supabase
        .from('dorms').select(DORM_COLS).eq('id', dormId).maybeSingle()
      if (error) throw error
      return (data as DormAttendanceConfig) ?? null
    },

    async enabledDorms(): Promise<DormAttendanceConfig[]> {
      const { data, error } = await supabase
        .from('dorms').select(DORM_COLS)
        .eq('attendance_enabled', true)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
      if (error) throw error
      return (data ?? []) as DormAttendanceConfig[]
    },

    // Active housed residents for a building, optionally narrowed to one
    // floor / gender (a sardor's scope).
    async residents(
      faculties: string[],
      opts: { floor?: number | null; gender?: string | null } = {},
    ): Promise<ResidentRow[]> {
      let query = supabase
        .from('users')
        .select('id, full_name, avatar_url, room_number, assigned_floor, gender, faculty')
        .eq('role', 'talaba')
        .eq('status', 'active')
        .in('faculty', faculties)
        .not('assigned_floor', 'is', null)
      if (opts.floor != null) query = query.eq('assigned_floor', opts.floor)
      if (opts.gender) query = query.eq('gender', opts.gender)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as ResidentRow[]
    },

    async openSessions(dormId: string): Promise<AttendanceSessionRow[]> {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('dorm_id', dormId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as AttendanceSessionRow[]
    },

    async sessionById(id: string): Promise<AttendanceSessionRow | null> {
      const { data, error } = await supabase
        .from('attendance_sessions').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return (data as AttendanceSessionRow) ?? null
    },

    // Nightly sessions dedupe on (dorm, date, kind, gender, floor) via a
    // functional unique index. PostgREST can't target that from onConflict,
    // so we insert and, on a 23505, return the row that already won.
    async upsertSession(input: {
      dormId: string
      scheduledFor: string
      kind: 'nightly' | 'adhoc'
      gender: 'male' | 'female' | null
      floor: number | null
      openedBy: string | null
      closesAt: string
    }): Promise<{ row: AttendanceSessionRow; created: boolean }> {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .insert({
          dorm_id: input.dormId,
          scheduled_for: input.scheduledFor,
          kind: input.kind,
          gender: input.gender,
          floor_number: input.floor,
          opened_by: input.openedBy,
          closes_at: input.closesAt,
        })
        .select('*')
        .single()
      if (!error) return { row: data as AttendanceSessionRow, created: true }
      if (error.code !== '23505') throw error

      let q = supabase
        .from('attendance_sessions').select('*')
        .eq('dorm_id', input.dormId)
        .eq('scheduled_for', input.scheduledFor)
        .eq('kind', input.kind)
      q = input.gender ? q.eq('gender', input.gender) : q.is('gender', null)
      q = input.floor != null ? q.eq('floor_number', input.floor) : q.is('floor_number', null)
      const { data: existing, error: fetchErr } = await q.maybeSingle()
      if (fetchErr) throw fetchErr
      return { row: existing as AttendanceSessionRow, created: false }
    },

    // Bulk-seed unmarked records for every resident; existing rows untouched.
    async seedRecords(
      sessionId: string,
      residents: ResidentRow[],
    ): Promise<void> {
      if (residents.length === 0) return
      const rows = residents.map((r) => ({
        session_id: sessionId,
        student_id: r.id,
        room_number: r.room_number ?? '',
        floor_number: r.assigned_floor,
        gender: r.gender,
        state: 'unmarked' as const,
      }))
      const { error } = await supabase
        .from('attendance_records')
        .upsert(rows, { onConflict: 'session_id, student_id', ignoreDuplicates: true })
      if (error) throw error
    },

    async records(sessionId: string): Promise<AttendanceRecordRow[]> {
      const { data, error } = await supabase
        .from('attendance_records').select('*').eq('session_id', sessionId)
      if (error) throw error
      return (data ?? []) as AttendanceRecordRow[]
    },

    async setRecordState(input: {
      sessionId: string
      studentId: string
      state: AttendanceState
      source: 'captain' | 'tarbiyachi'
      markedBy: string
      softFlag: boolean
    }): Promise<AttendanceRecordRow | null> {
      const { data, error } = await supabase
        .from('attendance_records')
        .update({
          state: input.state,
          source: input.source,
          marked_by: input.markedBy,
          marked_at: new Date().toISOString(),
          soft_flag: input.softFlag,
        })
        .eq('session_id', input.sessionId)
        .eq('student_id', input.studentId)
        .select('*')
        .maybeSingle()
      if (error) throw error
      return (data as AttendanceRecordRow) ?? null
    },

    // Self check-in never overrides a mark a human already made.
    async applySelfCheckin(input: {
      sessionId: string
      studentId: string
      state: 'present' | 'absent'
      selfLat: number
      selfLng: number
      selfAccuracyM: number
      selfDistanceM: number
    }): Promise<{ applied: boolean; current: AttendanceState }> {
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('state, source')
        .eq('session_id', input.sessionId)
        .eq('student_id', input.studentId)
        .maybeSingle()

      const audit = {
        self_lat: input.selfLat,
        self_lng: input.selfLng,
        self_accuracy_m: input.selfAccuracyM,
        self_distance_m: input.selfDistanceM,
      }

      if (existing && (existing.source === 'captain' || existing.source === 'tarbiyachi')) {
        // Keep the human decision; still record where the phone was.
        await supabase.from('attendance_records').update(audit)
          .eq('session_id', input.sessionId).eq('student_id', input.studentId)
        return { applied: false, current: existing.state as AttendanceState }
      }

      const { error } = await supabase
        .from('attendance_records')
        .update({
          ...audit,
          state: input.state,
          source: 'self_location',
          soft_flag: input.state === 'absent',
          marked_at: new Date().toISOString(),
        })
        .eq('session_id', input.sessionId)
        .eq('student_id', input.studentId)
      if (error) throw error
      return { applied: true, current: input.state }
    },

    async closeSession(id: string, status: 'closed' | 'auto_closed', closedBy: string | null): Promise<void> {
      const { error } = await supabase
        .from('attendance_sessions')
        .update({ status, closed_by: closedBy, closed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'open')
      if (error) throw error
    },

    async recordById(recordId: string) {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('id, student_id, session_id, state, soft_flag, room_number')
        .eq('id', recordId)
        .maybeSingle()
      if (error) throw error
      return data
    },

    // Same atomic RPC the dekan's manual warning uses (migration 202607300000):
    // inserts the arizalar row and re-derives users.warning_count together.
    async createWarning(studentId: string, title: string, text: string) {
      const { data, error } = await supabase.rpc('create_student_warning_atomic', {
        p_student_id: studentId,
        p_title: title,
        p_text: text,
        p_level: 'warning',
      })
      if (error) throw error
      const row = Array.isArray(data) ? data[0] : data
      return (row ?? null) as { warning_id: string; new_warning_count: number } | null
    },

    async clearFlag(recordId: string) {
      const { error } = await supabase
        .from('attendance_records').update({ soft_flag: false }).eq('id', recordId)
      if (error) throw error
    },

    async autoCloseExpired(dormId: string): Promise<void> {
      const { error } = await supabase
        .from('attendance_sessions')
        .update({ status: 'auto_closed', closed_at: new Date().toISOString() })
        .eq('dorm_id', dormId)
        .eq('status', 'open')
        .lt('closes_at', new Date().toISOString())
      if (error) throw error
    },

    async flaggedRecords(sessionIds: string[]) {
      if (sessionIds.length === 0) return [] as Pick<
        AttendanceRecordRow, 'id' | 'student_id' | 'room_number' | 'note' | 'session_id'
      >[]
      const { data, error } = await supabase
        .from('attendance_records')
        .select('id, student_id, room_number, note, session_id')
        .in('session_id', sessionIds)
        .eq('soft_flag', true)
        .eq('state', 'absent')
      if (error) throw error
      return data ?? []
    },

    async studentHistory(studentId: string, limit: number) {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('state, session_id')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      const rows = data ?? []
      if (rows.length === 0) return [] as { state: AttendanceState; scheduled_for: string; kind: 'nightly' | 'adhoc' }[]
      const { data: sessions } = await supabase
        .from('attendance_sessions')
        .select('id, scheduled_for, kind, status')
        .in('id', rows.map((r) => r.session_id))
      const byId = new Map((sessions ?? []).map((s) => [s.id, s]))
      return rows
        .map((r) => {
          const s = byId.get(r.session_id)
          if (!s || s.status === 'open') return null
          return { state: r.state as AttendanceState, scheduled_for: s.scheduled_for, kind: s.kind as 'nightly' | 'adhoc' }
        })
        .filter((x): x is { state: AttendanceState; scheduled_for: string; kind: 'nightly' | 'adhoc' } => x !== null)
    },
  }
}

export type AttendanceRepository = ReturnType<typeof createAttendanceRepository>
