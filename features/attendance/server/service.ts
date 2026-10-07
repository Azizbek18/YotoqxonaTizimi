import 'server-only'
import { roomIdentity } from '@/lib/room-identity'
import { ApiError } from '@/server/http/api-error'
import { asCoordinate, haversineMeters } from '@/lib/geo'
import {
  attendanceClosesAt,
  attendanceWindowJustOpened,
  isWithinAttendanceWindow,
  tashkentDateString,
} from '@/lib/tashkent-time'
import { sendPushWithoutBreaking } from '@/lib/push-notifications'
import { notifyStudent } from '@/lib/notify-student'
import { can } from '@/features/permissions/types'
import { createAttendanceRepository, type AttendanceRepository, type LegacySessionRow, type ResidentRow } from './repository'
import { createDekanAttendanceRepository, type DekanAttendanceRepository } from './dekan-repository'
import { dormLabel } from './dekan-service'
import { sendAttendanceReminders, sendCaptainAlert } from './dekan-notify'
import type {
  AttendanceActor,
  AttendanceState,
  AttendanceSummary,
  CheckinResult,
  RosterRoom,
  RosterView,
} from '../types'
import type { AttendanceRecordRow } from '@/types/database.generated'

type AttendanceSessionRow = LegacySessionRow

const HISTORY_LIMIT = 30

function summarise(records: Pick<AttendanceRecordRow, 'state'>[]): AttendanceSummary {
  const s: AttendanceSummary = { present: 0, absent: 0, excused: 0, unmarked: 0, total: records.length }
  for (const r of records) s[r.state] += 1
  return s
}

/** A plain resident may only read the open-session summary + self-check in;
 *  the roster and the session list are staff/sardor surfaces. */
function assertMarkerActor(actor: AttendanceActor): void {
  if (actor.role === 'talaba') {
    throw new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN')
  }
}

const MAX_RELIABLE_ACCURACY_M = 300

export const NIGHTLY_REMINDER_INTERVAL_MIN = 5
const REMINDER_INTERVAL_MS = NIGHTLY_REMINDER_INTERVAL_MIN * 60_000
// The cron ticks every ~5 minutes; a little slack keeps a tick from skipping a round.
const REMINDER_SLACK_MS = 60_000
// Floor captains get their own list this many minutes before close (cron
// ticks ~5 min apart, so each window is wide enough to catch exactly one tick).
const CAPTAIN_ALERT_WINDOWS = [
  { minutes: 10, fromMs: 6 * 60_000, toMs: 11 * 60_000 },
  { minutes: 5, fromMs: 0, toMs: 6 * 60_000 },
] as const

function sessionMatchesActor(session: AttendanceSessionRow, actor: AttendanceActor): boolean {
  if (session.dorm_id !== actor.dormId) return false
  if (actor.role !== 'sardor') return true
  if (session.gender && session.gender !== actor.gender) return false
  if (session.floor_number != null && session.floor_number !== actor.floor) return false
  // A blocked dorm has one captain per block per floor; a session opened for
  // block A is not block B's. Sessions without a block (nightly, legacy) are
  // dorm-wide and stay shared — the roster is still filtered by block.
  if (session.block != null && session.block !== (actor.block ?? null)) return false
  return true
}

export function createAttendanceService(
  repo: AttendanceRepository = createAttendanceRepository(),
  dekanRepo?: DekanAttendanceRepository,
) {
  // Lazy: only the student check-in / summary paths touch dekan sessions, and
  // unit tests of the legacy flow should not need a database for them.
  let dekanRepoInstance = dekanRepo
  const dekan = () => (dekanRepoInstance ??= createDekanAttendanceRepository())

  async function residentsForActor(actor: AttendanceActor): Promise<ResidentRow[]> {
    return repo.residents(actor.dormId, actor.faculties, {
      floor: actor.role === 'sardor' ? actor.floor : undefined,
      gender: actor.role === 'sardor' ? actor.gender : (actor.gender ?? undefined),
      block: actor.role === 'sardor' ? actor.block ?? null : undefined,
    })
  }

  async function loadRoster(actor: AttendanceActor, session: AttendanceSessionRow): Promise<RosterView> {
    // Lazy auto-close: a window that has run out closes on the next read.
    if (session.status === 'open' && new Date(session.closes_at).getTime() < Date.now()) {
      await repo.closeSession(session.id, 'auto_closed', null)
      session = { ...session, status: 'auto_closed' }
    }

    const [residents, records] = await Promise.all([
      residentsForActor(actor),
      repo.records(session.id),
    ])
    const byStudent = new Map(records.map((r) => [r.student_id, r]))

    const roomMap = new Map<string, RosterRoom>()
    for (const resident of residents) {
      const rec = byStudent.get(resident.id)
      const room = resident.block
        ? `${resident.block} · ${resident.assigned_floor}-qavat · ${resident.room_number}`
        : resident.room_number ?? '—'
      const key = roomIdentity({ ...resident, dorm_id: actor.dormId })
      if (!roomMap.has(key)) roomMap.set(key, { roomNumber: room, residents: [] })
      roomMap.get(key)!.residents.push({
        id: resident.id,
        fullName: resident.full_name ?? 'Talaba',
        avatarUrl: resident.avatar_url ?? null,
        roomNumber: room,
        state: (rec?.state ?? 'unmarked') as AttendanceState,
        source: rec?.source ?? null,
        softFlag: rec?.soft_flag ?? false,
        selfDistanceM: rec?.self_distance_m ?? null,
      })
    }

    const rooms = [...roomMap.values()].sort((a, b) =>
      a.roomNumber.localeCompare(b.roomNumber, 'uz', { numeric: true }),
    )
    const summary = summarise(
      rooms.flatMap((r) => r.residents.map((x) => ({ state: x.state }))),
    )

    return {
      session: {
        id: session.id,
        kind: session.kind,
        floor: session.floor_number,
        gender: session.gender,
        status: session.status,
        closesAt: session.closes_at,
        openedAt: session.opened_at,
      },
      rooms,
      summary,
      canWrite: actor.canWrite && session.status === 'open',
    }
  }

  return {
    /** Open sessions the actor can see/act on right now. */
    async activeSessions(actor: AttendanceActor) {
      assertMarkerActor(actor)
      const sessions = (await repo.openSessions(actor.dormId)).filter((s) => sessionMatchesActor(s, actor))
      return sessions.map((s) => ({
        id: s.id,
        kind: s.kind,
        floor: s.floor_number,
        gender: s.gender,
        status: s.status,
        closesAt: s.closes_at,
        openedAt: s.opened_at,
      }))
    },

    /** Start an unscheduled session for the actor's scope. */
    async openAdhoc(actor: AttendanceActor) {
      if (!actor.canWrite) throw new ApiError(403, 'Faqat sardor yoki tarbiyachi yo‘qlama ocha oladi')
      const dorm = await repo.dorm(actor.dormId)
      if (!dorm) throw new ApiError(409, 'Yotoqxona topilmadi')

      const scheduledFor = tashkentDateString()
      const closesAt = attendanceClosesAt(scheduledFor, dorm.attendance_open_time, dorm.attendance_close_time)
      // An ad-hoc check now shouldn't already be past its computed close.
      const effectiveClose = closesAt.getTime() > Date.now()
        ? closesAt
        : new Date(Date.now() + 2 * 60 * 60_000)

      const { row } = await repo.upsertSession({
        dormId: actor.dormId,
        scheduledFor,
        kind: 'adhoc',
        gender: actor.role === 'sardor' ? actor.gender : actor.gender,
        floor: actor.role === 'sardor' ? actor.floor : null,
        block: actor.role === 'sardor' ? actor.block ?? null : null,
        openedBy: actor.userId,
        closesAt: effectiveClose.toISOString(),
      })
      await repo.seedRecords(row.id, await residentsForActor(actor))
      return loadRoster(actor, row)
    },

    async roster(actor: AttendanceActor, sessionId: string): Promise<RosterView> {
      assertMarkerActor(actor)
      const session = await repo.sessionById(sessionId)
      if (!session || !sessionMatchesActor(session, actor)) {
        throw new ApiError(404, 'Yo‘qlama sessiyasi topilmadi')
      }
      // Late residents / a session opened by cron before this actor looked:
      // make sure everyone in scope has a row.
      if (session.status === 'open') {
        await repo.seedRecords(sessionId, await residentsForActor(actor))
      }
      return loadRoster(actor, session)
    },

    async mark(actor: AttendanceActor, sessionId: string, studentId: string, state: AttendanceState) {
      if (!actor.canWrite) throw new ApiError(403, 'Sizda belgilash huquqi yo‘q')
      if (state === 'unmarked') throw new ApiError(400, 'Holat noto‘g‘ri')

      const session = await repo.sessionById(sessionId)
      if (!session || !sessionMatchesActor(session, actor)) throw new ApiError(404, 'Sessiya topilmadi')
      if (session.status !== 'open') throw new ApiError(409, 'Yo‘qlama yopilgan')

      const inScope = (await residentsForActor(actor)).some((r) => r.id === studentId)
      if (!inScope) throw new ApiError(403, 'Bu talaba sizning yo‘qlamangizga kirmaydi')

      const updated = await repo.setRecordState({
        sessionId,
        studentId,
        state,
        source: actor.role === 'sardor' ? 'captain' : 'tarbiyachi',
        markedBy: actor.userId,
        softFlag: state === 'absent',
      })
      if (!updated) {
        // Resident with no seeded row yet — seed then retry once.
        await repo.seedRecords(sessionId, await residentsForActor(actor))
        return repo.setRecordState({
          sessionId, studentId, state,
          source: actor.role === 'sardor' ? 'captain' : 'tarbiyachi',
          markedBy: actor.userId, softFlag: state === 'absent',
        })
      }
      return updated
    },

    async close(actor: AttendanceActor, sessionId: string) {
      if (!actor.canWrite) throw new ApiError(403, 'Sizda yopish huquqi yo‘q')
      const session = await repo.sessionById(sessionId)
      if (!session || !sessionMatchesActor(session, actor)) throw new ApiError(404, 'Sessiya topilmadi')
      if (session.status !== 'open') return { ok: true as const, already: true }
      await repo.closeSession(sessionId, 'closed', actor.userId)
      return { ok: true as const, already: false }
    },

    /** Dashboard tile: the dorm's latest session and its counts. */
    async summary(actor: AttendanceActor) {
      const open = (await repo.openSessions(actor.dormId)).filter((s) => sessionMatchesActor(s, actor))

      // A plain resident's "Men yotoqxonadaman" screen also lights up for a
      // roll-call their own dekan opened — for THEIR dorm and THEIR faculty
      // only. Staff dashboards never include dekan sessions.
      if (actor.role === 'talaba') {
        const faculty = actor.faculties[0]
        const dekanOpen = faculty ? await dekan().openForStudent(actor.dormId, faculty, new Date()) : null
        if (open.length === 0 && !dekanOpen) return { hasOpen: false as const }
        const closes = [...open.map((s) => s.closes_at), ...(dekanOpen ? [dekanOpen.closes_at] : [])]
        closes.sort()
        const records = (await Promise.all(open.map((s) => repo.records(s.id)))).flat()
        // The student's OWN verdict, so the screen can say "you are confirmed"
        // after a reload instead of offering the button again.
        const mineIds = [
          ...open.filter((s) => s.kind === 'nightly' || s.floor_number == null).map((s) => s.id),
          ...(dekanOpen ? [dekanOpen.id] : []),
        ]
        const states = await repo.studentStates(actor.userId, mineIds)
        const myState: AttendanceState | null =
          states.includes('present') ? 'present'
          : states.includes('absent') ? 'absent'
          : states.includes('excused') ? 'excused'
          : states.length > 0 ? 'unmarked' : null
        return { hasOpen: true as const, closesAt: closes[closes.length - 1], summary: summarise(records), myState }
      }

      if (open.length === 0) return { hasOpen: false as const }
      const records = (await Promise.all(open.map((s) => repo.records(s.id)))).flat()
      return {
        hasOpen: true as const,
        closesAt: open[0].closes_at,
        summary: summarise(records),
      }
    },

    /**
     * Last-10-minutes alert to each floor captain, separate from the students'
     * reminders: who on THEIR floor (floor + gender + block) has not confirmed.
     * Sent at ~10 and ~5 minutes before close, once per window, only when
     * someone is still unconfirmed. Push + Telegram, best-effort.
     */
    async runCaptainAlerts(now: Date = new Date()) {
      const result = { alerted: 0 }
      for (const dorm of await repo.enabledDorms()) {
        try {
          const sessions = (await repo.openSessions(dorm.id)).filter((s) => s.kind === 'nightly')
          for (const session of sessions) {
            const left = new Date(session.closes_at).getTime() - now.getTime()
            const window = CAPTAIN_ALERT_WINDOWS.find((w) => left > w.fromMs && left <= w.toMs)
            if (!window) continue

            const unmarked = (await repo.records(session.id)).filter((r) => r.state === 'unmarked')
            if (unmarked.length === 0) continue
            if (!(await repo.claimAlertSlot(`${session.id}:${window.minutes}`))) continue

            const captains = (await repo.captainsOf(dorm.id))
              .filter((c) => can(c.captain_permissions, 'attendance.mark'))
            if (captains.length === 0) continue
            const [residents, chats] = await Promise.all([
              repo.residents(dorm.id, await repo.facultiesForDorm(dorm.id), {}),
              dekan().telegramChats(captains.map((c) => c.id)),
            ])
            const unmarkedIds = new Set(unmarked.map((r) => r.student_id))

            for (const captain of captains) {
              // Same scope the captain marks in: floor + gender + block.
              const mine = residents.filter((r) =>
                unmarkedIds.has(r.id)
                && r.assigned_floor === captain.assigned_floor
                && r.gender === captain.gender
                && (r.block ?? null) === (captain.block ?? null))
              if (mine.length === 0) continue
              const students = mine
                .map((r) => `${r.full_name ?? 'Talaba'}${r.room_number ? ` (${r.room_number})` : ''}`)
                .sort((a, b) => a.localeCompare(b))
              await sendCaptainAlert({
                captainId: captain.id,
                chatId: chats.get(captain.id) ?? null,
                floor: captain.assigned_floor,
                minutesLeft: window.minutes,
                students,
              })
              result.alerted += 1
            }
          }
        } catch (error) {
          console.error('Captain attendance alert failed:', dorm.id, error)
        }
      }
      return result
    },

    async history(actor: AttendanceActor, studentId: string) {
      // Staff only, and only sessions of the actor's own building — a plain
      // resident must not read a neighbour's attendance by id.
      if (actor.role !== 'tarbiyachi' && actor.role !== 'dekan') {
        throw new ApiError(403, 'Faqat tarbiyachi yoki dekan')
      }
      const rows = await repo.studentHistory(studentId, actor.dormId, HISTORY_LIMIT)
      return rows.map((r) => ({ date: r.scheduled_for, state: r.state, kind: r.kind }))
    },

    async flags(actor: AttendanceActor) {
      if (actor.role !== 'tarbiyachi') throw new ApiError(403, 'Faqat tarbiyachi')
      const open = await repo.openSessions(actor.dormId)
      const byId = new Map(open.map((s) => [s.id, s]))
      const rows = await repo.flaggedRecords([...byId.keys()])
      return rows.map((r) => ({
        recordId: r.id,
        studentId: r.student_id,
        roomNumber: r.room_number,
        note: r.note,
        sessionDate: byId.get(r.session_id)?.scheduled_for ?? '',
      }))
    },

    /** Turn one "uzrsiz yo'q" flag into a disciplinary warning. */
    async promoteFlag(actor: AttendanceActor, recordId: string) {
      if (actor.role !== 'tarbiyachi') throw new ApiError(403, 'Faqat tarbiyachi')
      const record = await repo.recordById(recordId)
      if (!record) throw new ApiError(404, 'Yozuv topilmadi')
      const session = await repo.sessionById(record.session_id)
      if (!session || session.dorm_id !== actor.dormId) throw new ApiError(403, 'Boshqa yotoqxona')
      if (!record.soft_flag || record.state !== 'absent') {
        throw new ApiError(409, 'Bu yozuv ogohlantirishga tayyor emas')
      }
      const result = await repo.createWarning(
        record.student_id,
        'Yo‘qlamada sababsiz yo‘q',
        `${session.scheduled_for} sanasidagi yo‘qlamada sababsiz yo‘q deb qayd etildi.`,
      )
      await repo.clearFlag(recordId)
      return { ok: true as const, warningCount: result?.new_warning_count ?? null }
    },

    /** Dismiss a flag without a warning (phone died, etc.). */
    async dismissFlag(actor: AttendanceActor, recordId: string) {
      if (actor.role !== 'tarbiyachi') throw new ApiError(403, 'Faqat tarbiyachi')
      const record = await repo.recordById(recordId)
      if (!record) throw new ApiError(404, 'Yozuv topilmadi')
      const session = await repo.sessionById(record.session_id)
      if (!session || session.dorm_id !== actor.dormId) throw new ApiError(403, 'Boshqa yotoqxona')
      await repo.clearFlag(recordId)
      return { ok: true as const }
    },

    // ---- 2-bosqich: talaba joylashuv bilan tasdiqi ----
    async checkin(userId: string, faculty: string, coords: unknown): Promise<CheckinResult> {
      // The student's OWN building — a faculty can live in several, and its
      // primary one is not necessarily where this student sleeps.
      const dormId = (await repo.studentDormId(userId)) ?? (await repo.dormIdForFaculty(faculty))
      if (!dormId) return { status: 'no_session' }
      const dorm = await repo.dorm(dormId)
      if (!dorm) return { status: 'no_session' }

      const open = (await repo.openSessions(dormId)).filter((s) => s.kind === 'nightly' || s.floor_number == null)
      const nightly = open.find((s) => new Date(s.closes_at).getTime() >= Date.now()) ?? null
      // The dekan's own roll-call for this student's dorm + faculty, if one
      // is running. Matched on BOTH — never another faculty's or dorm's.
      const dekanSession = await dekan().openForStudent(dormId, faculty, new Date())
      if (!nightly && !dekanSession) return { status: 'no_session' }

      if (dorm.latitude == null || dorm.longitude == null) return { status: 'unavailable' }

      const body = (coords ?? {}) as { lat?: unknown; lng?: unknown; accuracy?: unknown }
      const point = asCoordinate(body.lat, body.lng)
      const accuracy = Math.round(Number(body.accuracy))
      if (!point || !Number.isFinite(accuracy)) return { status: 'retry' }
      // A coarse fix (Wi-Fi / cell / the phone's "approximate location", 1–2 km)
      // says nothing about where the student is, so it must never produce a
      // verdict — least of all "absent". Real GPS fixes here are ≤ ~240 m.
      if (accuracy > MAX_RELIABLE_ACCURACY_M) return { status: 'retry' }

      const distance = haversineMeters(point, { lat: dorm.latitude, lng: dorm.longitude })
      // The fix is a circle of `accuracy` metres around the reported point. If
      // that circle still reaches into the radius we cannot say they are outside.
      if (distance > dorm.checkin_radius_m && distance - accuracy <= dorm.checkin_radius_m) {
        return { status: 'retry' }
      }
      const state: 'present' | 'absent' = distance <= dorm.checkin_radius_m ? 'present' : 'absent'

      const audit = {
        studentId: userId,
        state,
        selfLat: point.lat,
        selfLng: point.lng,
        selfAccuracyM: accuracy,
        selfDistanceM: distance,
      }

      let applied = false
      let current: AttendanceState = state

      if (nightly) {
        // Ensure a row exists (cron seeds it, but be defensive).
        await repo.seedRecords(nightly.id, await repo.residents(dormId, await repo.facultiesForDorm(dormId), {}))
        const r = await repo.applySelfCheckin({ sessionId: nightly.id, ...audit })
        applied = applied || r.applied
        if (!r.applied) current = r.current
      }

      if (dekanSession) {
        // Only if the student really is a roll-call resident of this exact
        // dorm + faculty; otherwise their tap must not create a stray row.
        const resident = await dekan().residentOf(userId, dormId, faculty)
        if (resident) {
          await repo.seedRecords(dekanSession.id, [resident])
          const r = await repo.applySelfCheckin({ sessionId: dekanSession.id, ...audit })
          applied = applied || r.applied
          if (!r.applied && !nightly) current = r.current
        } else if (!nightly) {
          return { status: 'no_session' }
        }
      }

      if (!applied) return { status: 'already', state: current }
      return state === 'present'
        ? { status: 'present', distanceM: distance }
        : { status: 'outside', distanceM: distance }
    },

    // ---- 2-bosqich: cron ----
    async runNightlyCron(now: Date = new Date()) {
      const dorms = await repo.enabledDorms()
      const opened: string[] = []
      const scheduledFor = tashkentDateString(now)

      for (const dorm of dorms) {
        await repo.autoCloseExpired(dorm.id)

        if (!isWithinAttendanceWindow(dorm.attendance_open_time, dorm.attendance_close_time, now)) continue
        if (!attendanceWindowJustOpened(dorm.attendance_open_time, now)) continue

        const closesAt = attendanceClosesAt(scheduledFor, dorm.attendance_open_time, dorm.attendance_close_time)
        const { row, created } = await repo.upsertSession({
          dormId: dorm.id,
          scheduledFor,
          kind: 'nightly',
          gender: null,
          floor: null,
          openedBy: null,
          closesAt: closesAt.toISOString(),
        })
        if (!created) continue

        const faculties = await repo.facultiesForDorm(dorm.id)
        const residents = await repo.residents(dorm.id, faculties, {})
        await repo.seedRecords(row.id, residents)
        opened.push(row.id)

        await Promise.all(residents.map((r) =>
          sendPushWithoutBreaking(() => notifyStudent(r.id, {
            title: 'Yo‘qlama boshlandi',
            body: `${dorm.attendance_close_time} gacha yotoqxonada ekanligingizni tasdiqlang.`,
            url: '/talaba/yoqlama',
            tag: `attendance-${row.id}`,
          })),
        ))
      }

      return { openedSessions: opened.length }
    },

    /**
     * Every NIGHTLY_REMINDER_INTERVAL_MIN minutes, Telegram + push to each
     * resident of an open nightly session who has not confirmed yet. The
     * first round (right after the session opens) is Telegram-only, because
     * runNightlyCron already sent the start push. Best-effort per dorm: one failure never stops the rest.
     */
    async runNightlyReminders(now: Date = new Date()) {
      const result = { reminded: 0 }
      for (const dorm of await repo.enabledDorms()) {
        try {
          const sessions = (await repo.openSessions(dorm.id))
            .filter((s) => s.kind === 'nightly' && new Date(s.closes_at).getTime() > now.getTime())
          for (const session of sessions) {
            const last = session.last_reminded_at ? new Date(session.last_reminded_at).getTime() : null
            if (last != null && now.getTime() < last + REMINDER_INTERVAL_MS - REMINDER_SLACK_MS) continue
            if (!(await repo.claimNightlyReminder(session, now))) continue
            const unmarked = (await repo.records(session.id)).filter((r) => r.state === 'unmarked')
            if (unmarked.length === 0) continue
            const ids = unmarked.map((r) => r.student_id)
            const [contacts, chats] = await Promise.all([dekan().contacts(ids), dekan().telegramChats(ids)])
            await sendAttendanceReminders(
              contacts.map((c) => ({ ...c, chatId: chats.get(c.id) ?? null })),
              {
                sessionId: session.id,
                dormLabel: dormLabel(dorm),
                closesAt: new Date(session.closes_at),
                round: session.reminder_count + 1,
                // runNightlyCron already pushed the start; the first round adds Telegram only.
                skipPush: last == null,
              },
            )
            result.reminded += 1
          }
        } catch (error) {
          console.error('Nightly attendance reminder failed:', dorm.id, error)
        }
      }
      return result
    },
  }
}

export type AttendanceService = ReturnType<typeof createAttendanceService>
