import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { AttendanceRecordRow, AttendanceSessionRow } from '@/types/database.generated'
import type { ResidentRow } from './repository'

export type DekanSessionRow = Omit<AttendanceSessionRow, 'kind' | 'faculty' | 'starts_at'> & {
  kind: 'dekan'
  faculty: string
  starts_at: string
}

export type DormBrief = {
  id: string
  number: string
  name: string
  latitude: number | null
  longitude: number | null
}

export type StudentContact = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  phone_number: string | null
  room_number: string | null
  assigned_floor: number | null
}

const PAGE = 1000
const ID_CHUNK = 100

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// A resident of a dorm for roll-call purposes — kept identical to
// AttendanceRepository.residents() so the dekan roll covers exactly the same
// people the other flow would, just narrowed to one faculty.
const RESIDENT_COLS = 'id, full_name, avatar_url, room_number, assigned_floor, gender, faculty'

export function createDekanAttendanceRepository() {
  const supabase = getServiceSupabase()

  return {
    /** Active housed residents of ONE faculty per dorm: dormId -> head-count. */
    async residentCountsByDorm(faculty: string): Promise<Map<string, number>> {
      const counts = new Map<string, number>()
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('users')
          .select('dorm_id')
          .eq('role', 'talaba')
          .eq('status', 'active')
          .eq('is_off_campus', false)
          .eq('faculty', faculty)
          .not('dorm_id', 'is', null)
          .not('assigned_floor', 'is', null)
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        for (const row of data ?? []) {
          if (row.dorm_id) counts.set(row.dorm_id, (counts.get(row.dorm_id) ?? 0) + 1)
        }
        if ((data?.length ?? 0) < PAGE) break
      }
      return counts
    },

    async dorms(ids: string[]): Promise<DormBrief[]> {
      if (ids.length === 0) return []
      const { data, error } = await supabase
        .from('dorms').select('id, number, name, latitude, longitude').in('id', ids)
      if (error) throw error
      return (data ?? []) as DormBrief[]
    },

    /** Residents of exactly (dorm, faculty) — never anyone else's. */
    async residents(dormId: string, faculty: string): Promise<ResidentRow[]> {
      const out: ResidentRow[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('users')
          .select(RESIDENT_COLS)
          .eq('role', 'talaba')
          .eq('status', 'active')
          .eq('is_off_campus', false)
          .eq('dorm_id', dormId)
          .eq('faculty', faculty)
          .not('assigned_floor', 'is', null)
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        out.push(...((data ?? []) as ResidentRow[]))
        if ((data?.length ?? 0) < PAGE) break
      }
      return out
    },

    /** One student, only if they are a roll-call resident of (dorm, faculty). */
    async residentOf(studentId: string, dormId: string, faculty: string): Promise<ResidentRow | null> {
      const { data, error } = await supabase
        .from('users')
        .select(RESIDENT_COLS)
        .eq('id', studentId)
        .eq('role', 'talaba')
        .eq('status', 'active')
        .eq('is_off_campus', false)
        .eq('dorm_id', dormId)
        .eq('faculty', faculty)
        .not('assigned_floor', 'is', null)
        .maybeSingle()
      if (error) throw error
      return (data as ResidentRow) ?? null
    },

    async contacts(ids: string[]): Promise<StudentContact[]> {
      const out: StudentContact[] = []
      for (const part of chunk(ids, ID_CHUNK)) {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email, phone, phone_number, room_number, assigned_floor')
          .in('id', part)
        if (error) throw error
        out.push(...((data ?? []) as StudentContact[]))
      }
      return out
    },

    async telegramChats(ids: string[]): Promise<Map<string, string>> {
      const out = new Map<string, string>()
      for (const part of chunk(ids, ID_CHUNK)) {
        const { data, error } = await supabase
          .from('student_telegram_links').select('student_id, chat_id').in('student_id', part)
        if (error) throw error
        for (const row of data ?? []) if (row.chat_id != null) out.set(row.student_id, String(row.chat_id))
      }
      return out
    },

    async sessionForFaculty(id: string, faculty: string): Promise<DekanSessionRow | null> {
      const { data, error } = await supabase
        .from('attendance_sessions').select('*')
        .eq('id', id).eq('kind', 'dekan').eq('faculty', faculty).maybeSingle()
      if (error) throw error
      return (data as DekanSessionRow) ?? null
    },

    async sessionById(id: string): Promise<DekanSessionRow | null> {
      const { data, error } = await supabase
        .from('attendance_sessions').select('*').eq('id', id).eq('kind', 'dekan').maybeSingle()
      if (error) throw error
      return (data as DekanSessionRow) ?? null
    },

    /** The one scheduled/open session of (dorm, faculty), if any. */
    async activeFor(dormId: string, faculty: string): Promise<DekanSessionRow | null> {
      const { data, error } = await supabase
        .from('attendance_sessions').select('*')
        .eq('kind', 'dekan').eq('dorm_id', dormId).eq('faculty', faculty)
        .in('status', ['scheduled', 'open'])
        .maybeSingle()
      if (error) throw error
      return (data as DekanSessionRow) ?? null
    },

    /** The student's own open dekan session: their dorm AND their faculty. */
    async openForStudent(dormId: string, faculty: string, now: Date): Promise<DekanSessionRow | null> {
      const iso = now.toISOString()
      const { data, error } = await supabase
        .from('attendance_sessions').select('*')
        .eq('kind', 'dekan').eq('dorm_id', dormId).eq('faculty', faculty)
        .eq('status', 'open')
        .lte('starts_at', iso)
        .gt('closes_at', iso)
        .maybeSingle()
      if (error) throw error
      return (data as DekanSessionRow) ?? null
    },

    async recentFor(faculty: string, limit: number): Promise<DekanSessionRow[]> {
      const { data, error } = await supabase
        .from('attendance_sessions').select('*')
        .eq('kind', 'dekan').eq('faculty', faculty)
        .in('status', ['closed', 'auto_closed'])
        .order('starts_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as DekanSessionRow[]
    },

    /** This faculty's started roll-calls whose Toshkent date is in [from, to]. */
    async sessionsInRange(
      faculty: string,
      dormId: string | null,
      from: string,
      to: string,
    ): Promise<DekanSessionRow[]> {
      let query = supabase
        .from('attendance_sessions').select('*')
        .eq('kind', 'dekan').eq('faculty', faculty)
        .in('status', ['open', 'closed', 'auto_closed'])
        .gte('scheduled_for', from)
        .lte('scheduled_for', to)
        .order('starts_at', { ascending: false })
      if (dormId) query = query.eq('dorm_id', dormId)
      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as DekanSessionRow[]
    },

    /** Records of several sessions, past PostgREST's 1000-row page. */
    async recordsForSessions(sessionIds: string[]): Promise<AttendanceRecordRow[]> {
      const out: AttendanceRecordRow[] = []
      for (const part of chunk(sessionIds, 10)) {
        for (let from = 0; ; from += PAGE) {
          const { data, error } = await supabase
            .from('attendance_records').select('*')
            .in('session_id', part)
            .order('id')
            .range(from, from + PAGE - 1)
          if (error) throw error
          out.push(...((data ?? []) as AttendanceRecordRow[]))
          if ((data?.length ?? 0) < PAGE) break
        }
      }
      return out
    },

    async activeForFaculty(faculty: string): Promise<DekanSessionRow[]> {
      const { data, error } = await supabase
        .from('attendance_sessions').select('*')
        .eq('kind', 'dekan').eq('faculty', faculty)
        .in('status', ['scheduled', 'open'])
      if (error) throw error
      return (data ?? []) as DekanSessionRow[]
    },

    async insertSession(input: {
      dormId: string
      faculty: string
      startsAt: string
      closesAt: string
      status: 'scheduled' | 'open'
      scheduledFor: string
      openedBy: string
      reminded: boolean
    }): Promise<{ row: DekanSessionRow | null; conflict: boolean }> {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .insert({
          dorm_id: input.dormId,
          faculty: input.faculty,
          kind: 'dekan',
          scheduled_for: input.scheduledFor,
          starts_at: input.startsAt,
          closes_at: input.closesAt,
          status: input.status,
          opened_by: input.openedBy,
          ...(input.reminded
            ? { last_reminded_at: new Date().toISOString(), reminder_count: 1 }
            : {}),
        })
        .select('*')
        .single()
      if (!error) return { row: data as DekanSessionRow, conflict: false }
      if (error.code === '23505') return { row: null, conflict: true }
      throw error
    },

    /** Records of one session, past PostgREST's 1000-row page. */
    async records(sessionId: string): Promise<AttendanceRecordRow[]> {
      const out: AttendanceRecordRow[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('attendance_records').select('*')
          .eq('session_id', sessionId)
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        out.push(...((data ?? []) as AttendanceRecordRow[]))
        if ((data?.length ?? 0) < PAGE) break
      }
      return out
    },

    /** scheduled -> open exactly once, however many cron runs race for it. */
    async promote(id: string, now: Date): Promise<DekanSessionRow | null> {
      const iso = now.toISOString()
      const { data, error } = await supabase
        .from('attendance_sessions')
        .update({ status: 'open', opened_at: iso, last_reminded_at: iso, reminder_count: 1 })
        .eq('id', id).eq('kind', 'dekan').eq('status', 'scheduled')
        .select('*')
        .maybeSingle()
      if (error) throw error
      return (data as DekanSessionRow) ?? null
    },

    async close(id: string, status: 'closed' | 'auto_closed', closedBy: string | null): Promise<boolean> {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .update({ status, closed_by: closedBy, closed_at: new Date().toISOString() })
        .eq('id', id).eq('kind', 'dekan').in('status', ['scheduled', 'open'])
        .select('id')
      if (error) throw error
      return (data?.length ?? 0) > 0
    },

    /** Scheduled sessions whose start time has come. */
    async dueToStart(now: Date): Promise<DekanSessionRow[]> {
      const { data, error } = await supabase
        .from('attendance_sessions').select('*')
        .eq('kind', 'dekan').eq('status', 'scheduled')
        .lte('starts_at', now.toISOString())
      if (error) throw error
      return (data ?? []) as DekanSessionRow[]
    },

    async openSessions(): Promise<DekanSessionRow[]> {
      const { data, error } = await supabase
        .from('attendance_sessions').select('*')
        .eq('kind', 'dekan').eq('status', 'open')
      if (error) throw error
      return (data ?? []) as DekanSessionRow[]
    },

    /**
     * Claim this session's next reminder. The compare-and-set on
     * last_reminded_at means two overlapping cron runs can never both send.
     */
    async claimReminder(session: DekanSessionRow, now: Date): Promise<boolean> {
      let q = supabase
        .from('attendance_sessions')
        .update({ last_reminded_at: now.toISOString(), reminder_count: session.reminder_count + 1 })
        .eq('id', session.id).eq('kind', 'dekan').eq('status', 'open')
      q = session.last_reminded_at ? q.eq('last_reminded_at', session.last_reminded_at) : q.is('last_reminded_at', null)
      const { data, error } = await q.select('id')
      if (error) throw error
      return (data?.length ?? 0) > 0
    },
  }
}

export type DekanAttendanceRepository = ReturnType<typeof createDekanAttendanceRepository>
