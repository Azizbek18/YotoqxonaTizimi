import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { tashkentDateString } from '@/lib/tashkent-time'
import { createAttendanceRepository, type AttendanceRepository } from './repository'
import {
  createDekanAttendanceRepository,
  type DekanAttendanceRepository,
  type DekanSessionRow,
  type DormBrief,
} from './dekan-repository'
import { sendAttendanceReminders, type ReminderSender } from './dekan-notify'
import type {
  AttendanceSummary,
  DekanDormCard,
  DekanHistoryDay,
  DekanHistoryState,
  DekanHistoryStudent,
  DekanHistoryView,
  DekanOverview,
  DekanRosterResident,
  DekanRosterView,
  DekanSessionInfo,
} from '../types'

/** Who is acting: one dekan (or a superadmin who picked a faculty). */
export type DekanScope = { userId: string; faculty: string }

const RECENT_LIMIT = 10
const HISTORY_MAX_DAYS = 31
const DAY_MS = 24 * 60 * 60_000
const MIN_DURATION_MS = 10 * 60_000
const MAX_DURATION_MS = 12 * 60 * 60_000
const MAX_LEAD_MS = 14 * 24 * 60 * 60_000
// A start time within this of "now" means "start right away".
const START_NOW_SLACK_MS = 90_000
// GitHub's scheduler runs a few minutes apart; the claim below is a
// compare-and-set, so a small slack only avoids skipping a round.
const REMINDER_SLACK_MS = 60_000

export function dormLabel(d: Pick<DormBrief, 'number' | 'name'>): string {
  const number = String(d.number ?? '').trim()
  const name = String(d.name ?? '').trim()
  if (number && name) return `${number}-${name}`
  if (number) return `${number}-yotoqxona`
  return name || 'Yotoqxona'
}

const STATE_RANK: Record<DekanHistoryState, number> = { present: 2, absent: 1, unmarked: 0 }

/** `YYYY-MM-DD` shifted by whole days (calendar arithmetic, no timezone drift). */
function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10)
}

function emptySummary(): AttendanceSummary {
  return { present: 0, absent: 0, excused: 0, unmarked: 0, total: 0 }
}

export function createDekanAttendanceService(
  deps: {
    repo?: AttendanceRepository
    drepo?: DekanAttendanceRepository
    send?: ReminderSender
    now?: () => Date
  } = {},
) {
  const repo = deps.repo ?? createAttendanceRepository()
  const drepo = deps.drepo ?? createDekanAttendanceRepository()
  const send = deps.send ?? sendAttendanceReminders
  const now = deps.now ?? (() => new Date())

  /** Every dorm this faculty actually has roll-call residents in. */
  async function facultyDorms(faculty: string) {
    const counts = await drepo.residentCountsByDorm(faculty)
    const dorms = await drepo.dorms([...counts.keys()])
    return { counts, dorms }
  }

  async function assertDormOfFaculty(faculty: string, dormId: string) {
    const { counts, dorms } = await facultyDorms(faculty)
    const dorm = dorms.find((d) => d.id === dormId)
    if (!dorm || (counts.get(dormId) ?? 0) === 0) {
      // Same answer for "no such dorm" and "someone else's dorm".
      throw new ApiError(403, 'Bu yotoqxonada fakultetingiz talabasi yo‘q')
    }
    return { dorm, residentCount: counts.get(dormId) ?? 0 }
  }

  async function summaryOf(session: DekanSessionRow): Promise<AttendanceSummary> {
    if (session.status === 'scheduled') return emptySummary()
    const records = await drepo.records(session.id)
    const s = emptySummary()
    for (const r of records) s[r.state] += 1
    s.total = records.length
    return s
  }

  function info(session: DekanSessionRow, label: string, summary: AttendanceSummary): DekanSessionInfo {
    return {
      id: session.id,
      dormId: session.dorm_id,
      dormLabel: label,
      status: session.status,
      startsAt: session.starts_at,
      closesAt: session.closes_at,
      closedAt: session.closed_at,
      reminderCount: session.reminder_count,
      summary,
    }
  }

  /** A window that has run out closes on the next read, like the legacy flow. */
  async function settle(session: DekanSessionRow): Promise<DekanSessionRow> {
    if (session.status === 'open' && new Date(session.closes_at).getTime() <= now().getTime()) {
      await drepo.close(session.id, 'auto_closed', null)
      return { ...session, status: 'auto_closed', closed_at: now().toISOString() }
    }
    return session
  }

  /** Residents who are in this session's scope AND have not confirmed yet. */
  async function pendingResidents(session: DekanSessionRow) {
    const [residents, records] = await Promise.all([
      drepo.residents(session.dorm_id, session.faculty),
      drepo.records(session.id),
    ])
    const state = new Map(records.map((r) => [r.student_id, r.state]))
    return residents.filter((r) => (state.get(r.id) ?? 'unmarked') === 'unmarked')
  }

  async function deliver(session: DekanSessionRow, label: string, round: number) {
    const pending = await pendingResidents(session)
    if (pending.length === 0) return { attempted: 0 }
    const ids = pending.map((p) => p.id)
    const [contacts, chats] = await Promise.all([drepo.contacts(ids), drepo.telegramChats(ids)])
    const targets = contacts.map((c) => ({ ...c, chatId: chats.get(c.id) ?? null }))
    return send(targets, {
      sessionId: session.id,
      dormLabel: label,
      closesAt: new Date(session.closes_at),
      round,
    })
  }

  return {
    async overview(scope: DekanScope): Promise<DekanOverview> {
      const { counts, dorms } = await facultyDorms(scope.faculty)
      const labels = new Map(dorms.map((d) => [d.id, dormLabel(d)]))

      const active = await Promise.all((await drepo.activeForFaculty(scope.faculty)).map(settle))
      const stillActive = active.filter((s) => s.status === 'open' || s.status === 'scheduled')
      const activeByDorm = new Map(stillActive.map((s) => [s.dorm_id, s]))

      const cards: DekanDormCard[] = []
      for (const dorm of dorms) {
        const session = activeByDorm.get(dorm.id)
        cards.push({
          id: dorm.id,
          label: dormLabel(dorm),
          residentCount: counts.get(dorm.id) ?? 0,
          hasGeo: dorm.latitude != null && dorm.longitude != null,
          active: session ? info(session, dormLabel(dorm), await summaryOf(session)) : null,
        })
      }
      cards.sort((a, b) => a.label.localeCompare(b.label, 'uz', { numeric: true }))

      // Sessions that just auto-closed above belong in the history too.
      const justClosed = active.filter((s) => s.status === 'auto_closed')
      const recentRows = [
        ...justClosed,
        ...(await drepo.recentFor(scope.faculty, RECENT_LIMIT)).filter((r) => !justClosed.some((j) => j.id === r.id)),
      ].slice(0, RECENT_LIMIT)

      const missing = recentRows.map((r) => r.dorm_id).filter((id) => !labels.has(id))
      if (missing.length > 0) {
        for (const d of await drepo.dorms([...new Set(missing)])) labels.set(d.id, dormLabel(d))
      }
      const recent: DekanSessionInfo[] = []
      for (const row of recentRows) {
        const summary = await summaryOf(row)
        // A roll-call cancelled before it ever opened has no records: not history.
        if (summary.total === 0) continue
        recent.push(info(row, labels.get(row.dorm_id) ?? 'Yotoqxona', summary))
      }

      return { dorms: cards, recent }
    },

    /**
     * The last `days` days of this faculty's roll-calls (optionally one dorm):
     * a per-day summary plus every student's state per day. Isolation is the
     * faculty filter on the session query — records are only read for those.
     */
    async history(scope: DekanScope, input: { dormId?: string | null; days?: number }): Promise<DekanHistoryView> {
      const days = Math.min(Math.max(Math.floor(input.days ?? 7) || 7, 1), HISTORY_MAX_DAYS)
      const today = tashkentDateString(now())
      const dates = Array.from({ length: days }, (_, i) => shiftDate(today, -i))
      const dormId = input.dormId ?? null

      const sessions = await drepo.sessionsInRange(scope.faculty, dormId, dates[dates.length - 1], today)
      const records = sessions.length > 0 ? await drepo.recordsForSessions(sessions.map((s) => s.id)) : []

      const dateOf = new Map(sessions.map((s) => [s.id, s.scheduled_for]))
      const perDay = new Map<string, Map<string, DekanHistoryState>>()
      for (const r of records) {
        const date = dateOf.get(r.session_id)
        if (!date) continue
        const state: DekanHistoryState = r.state === 'present' || r.state === 'absent' ? r.state : 'unmarked'
        const day = perDay.get(date) ?? new Map<string, DekanHistoryState>()
        const prev = day.get(r.student_id)
        if (!prev || STATE_RANK[state] > STATE_RANK[prev]) day.set(r.student_id, state)
        perDay.set(date, day)
      }

      const nowMs = now().getTime()
      const dayViews: DekanHistoryDay[] = dates.map((date) => {
        const summary = emptySummary()
        for (const state of perDay.get(date)?.values() ?? []) summary[state] += 1
        summary.total = summary.present + summary.absent + summary.unmarked
        const ofDay = sessions.filter((s) => s.scheduled_for === date)
        return {
          date,
          sessionIds: ofDay.map((s) => s.id),
          live: ofDay.some((s) => s.status === 'open' && new Date(s.closes_at).getTime() > nowMs),
          summary,
        }
      })

      const studentIds = [...new Set(records.map((r) => r.student_id))]
      const contacts = new Map((await drepo.contacts(studentIds)).map((c) => [c.id, c]))
      const lastRoom = new Map<string, { room: string; floor: number | null }>()
      for (const r of records) {
        if (!lastRoom.has(r.student_id)) lastRoom.set(r.student_id, { room: r.room_number, floor: r.floor_number })
      }

      const students: DekanHistoryStudent[] = studentIds.map((id) => {
        const states: Record<string, DekanHistoryState> = {}
        const row: DekanHistoryStudent = {
          id,
          fullName: contacts.get(id)?.full_name ?? 'Talaba',
          roomNumber: contacts.get(id)?.room_number ?? lastRoom.get(id)?.room ?? '—',
          floor: contacts.get(id)?.assigned_floor ?? lastRoom.get(id)?.floor ?? null,
          states,
          present: 0,
          absent: 0,
          unmarked: 0,
        }
        for (const [date, day] of perDay) {
          const state = day.get(id)
          if (!state) continue
          states[date] = state
          row[state] += 1
        }
        return row
      })
      students.sort((a, b) =>
        a.roomNumber.localeCompare(b.roomNumber, 'uz', { numeric: true }) ||
        a.fullName.localeCompare(b.fullName, 'uz'),
      )

      return { dormId, dates, days: dayViews, students }
    },

    /**
     * Start (or schedule) a roll-call for ONE dorm of this faculty. Returns the
     * session; the caller fires `deliverStart` after the response when it is
     * already open so a slow mail provider never delays the dekan.
     */
    async create(
      scope: DekanScope,
      input: { dormId: string; startsAt?: string | null; closesAt: string },
    ): Promise<{ session: DekanSessionInfo; startedNow: boolean }> {
      const current = now()
      const closes = new Date(input.closesAt)
      if (Number.isNaN(closes.getTime())) throw new ApiError(400, 'Tugash vaqti noto‘g‘ri')
      const requestedStart = input.startsAt ? new Date(input.startsAt) : current
      if (Number.isNaN(requestedStart.getTime())) throw new ApiError(400, 'Boshlanish vaqti noto‘g‘ri')

      const startedNow = requestedStart.getTime() <= current.getTime() + START_NOW_SLACK_MS
      const start = startedNow ? current : requestedStart
      if (start.getTime() - current.getTime() > MAX_LEAD_MS) {
        throw new ApiError(400, 'Boshlanish vaqti 14 kundan uzoq bo‘lishi mumkin emas')
      }
      const duration = closes.getTime() - start.getTime()
      if (closes.getTime() <= current.getTime()) throw new ApiError(400, 'Tugash vaqti o‘tib ketgan')
      if (duration < MIN_DURATION_MS) throw new ApiError(400, 'Yo‘qlama kamida 10 daqiqa davom etishi kerak')
      if (duration > MAX_DURATION_MS) throw new ApiError(400, 'Yo‘qlama 12 soatdan uzoq bo‘lishi mumkin emas')

      const { dorm } = await assertDormOfFaculty(scope.faculty, input.dormId)
      if (dorm.latitude == null || dorm.longitude == null) {
        throw new ApiError(
          409,
          'Yotoqxona joylashuvi belgilanmagan — Sozlamalar bo‘limida bino joylashuvini kiriting',
          'DORM_GEO_MISSING',
        )
      }

      const { row, conflict } = await drepo.insertSession({
        dormId: dorm.id,
        faculty: scope.faculty,
        startsAt: start.toISOString(),
        closesAt: closes.toISOString(),
        status: startedNow ? 'open' : 'scheduled',
        scheduledFor: tashkentDateString(start),
        openedBy: scope.userId,
        reminded: startedNow,
      })
      if (conflict || !row) {
        throw new ApiError(409, 'Bu yotoqxona uchun faol yo‘qlama allaqachon bor', 'SESSION_EXISTS')
      }

      if (startedNow) await repo.seedRecords(row.id, await drepo.residents(dorm.id, scope.faculty))
      return {
        session: info(row, dormLabel(dorm), startedNow ? await summaryOf(row) : emptySummary()),
        startedNow,
      }
    },

    /** First reminder for a session that opened the moment it was created. */
    async deliverStart(sessionId: string) {
      const session = await drepo.sessionById(sessionId)
      if (!session || session.status !== 'open') return { attempted: 0 }
      const [dorm] = await drepo.dorms([session.dorm_id])
      return deliver(session, dorm ? dormLabel(dorm) : 'Yotoqxona', 1)
    },

    async roster(scope: DekanScope, sessionId: string): Promise<DekanRosterView> {
      const found = await drepo.sessionForFaculty(sessionId, scope.faculty)
      if (!found) throw new ApiError(404, 'Yo‘qlama topilmadi')
      const session = await settle(found)
      const [dorm] = await drepo.dorms([session.dorm_id])
      const label = dorm ? dormLabel(dorm) : 'Yotoqxona'

      let rows: DekanRosterResident[] = []
      if (session.status !== 'scheduled') {
        let records = await drepo.records(session.id)
        const known = new Set(records.map((r) => r.student_id))
        let scopeIds: Set<string> | null = null

        if (session.status === 'open') {
          // Live view = exactly the people who sleep in this dorm RIGHT NOW,
          // from this faculty — someone who moved out mid-roll drops off.
          const residents = await drepo.residents(session.dorm_id, session.faculty)
          scopeIds = new Set(residents.map((r) => r.id))
          if (residents.some((r) => !known.has(r.id))) {
            await repo.seedRecords(session.id, residents)
            records = await drepo.records(session.id)
          }
        }

        const visible = scopeIds ? records.filter((r) => scopeIds.has(r.student_id)) : records
        const contacts = new Map((await drepo.contacts(visible.map((r) => r.student_id))).map((c) => [c.id, c]))
        rows = visible.map((r) => {
          const c = contacts.get(r.student_id)
          return {
            id: r.student_id,
            fullName: c?.full_name ?? 'Talaba',
            roomNumber: (session.status === 'open' ? c?.room_number : null) ?? (r.room_number || '—'),
            floor: (session.status === 'open' ? c?.assigned_floor : null) ?? r.floor_number,
            phone: c?.phone_number ?? c?.phone ?? null,
            state: r.state === 'present' || r.state === 'absent' ? r.state : 'unmarked',
            selfDistanceM: r.self_distance_m,
            markedAt: r.marked_at,
          }
        })
        rows.sort((a, b) =>
          a.roomNumber.localeCompare(b.roomNumber, 'uz', { numeric: true }) ||
          a.fullName.localeCompare(b.fullName, 'uz'),
        )
      }

      const summary = emptySummary()
      for (const r of rows) summary[r.state] += 1
      summary.total = rows.length
      return { session: info(session, label, summary), residents: rows }
    },

    /** End now (open) or cancel (scheduled). Only this faculty's own session. */
    async close(scope: DekanScope, sessionId: string) {
      const session = await drepo.sessionForFaculty(sessionId, scope.faculty)
      if (!session) throw new ApiError(404, 'Yo‘qlama topilmadi')
      if (session.status === 'closed' || session.status === 'auto_closed') return { ok: true as const, already: true }
      const closed = await drepo.close(session.id, 'closed', scope.userId)
      return { ok: true as const, already: !closed }
    },

    /**
     * Cron tick (called every few minutes): open sessions whose start time has
     * come, close the ones whose window ran out, send each open session's
     * reminder when its interval is up. Safe to run concurrently.
     */
    async runCron() {
      const current = now()
      const result = { started: 0, closed: 0, reminded: 0 }

      for (const due of await drepo.dueToStart(current)) {
        if (new Date(due.closes_at).getTime() <= current.getTime()) {
          // The whole window was missed (cron down) — don't open a dead roll.
          if (await drepo.close(due.id, 'auto_closed', null)) result.closed += 1
          continue
        }
        const promoted = await drepo.promote(due.id, current)
        if (!promoted) continue // another run won
        await repo.seedRecords(promoted.id, await drepo.residents(promoted.dorm_id, promoted.faculty))
        const [dorm] = await drepo.dorms([promoted.dorm_id])
        await deliver(promoted, dorm ? dormLabel(dorm) : 'Yotoqxona', 1)
        result.started += 1
      }

      for (const open of await drepo.openSessions()) {
        if (new Date(open.closes_at).getTime() <= current.getTime()) {
          if (await drepo.close(open.id, 'auto_closed', null)) result.closed += 1
          continue
        }
        const last = open.last_reminded_at ? new Date(open.last_reminded_at).getTime() : 0
        const dueAt = last + open.reminder_interval_min * 60_000 - REMINDER_SLACK_MS
        if (current.getTime() < dueAt) continue
        const round = open.reminder_count + 1
        if (!(await drepo.claimReminder(open, current))) continue
        const [dorm] = await drepo.dorms([open.dorm_id])
        await deliver(open, dorm ? dormLabel(dorm) : 'Yotoqxona', round)
        result.reminded += 1
      }

      return result
    },
  }
}

export type DekanAttendanceService = ReturnType<typeof createDekanAttendanceService>
