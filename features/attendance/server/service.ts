import 'server-only'
import { ApiError } from '@/server/http/api-error'
import { asCoordinate, haversineMeters } from '@/lib/geo'
import {
  attendanceClosesAt,
  attendanceWindowJustOpened,
  isWithinAttendanceWindow,
  tashkentDateString,
} from '@/lib/tashkent-time'
import { sendPushForUser, sendPushWithoutBreaking } from '@/lib/push-notifications'
import { createAttendanceRepository, type AttendanceRepository, type ResidentRow } from './repository'
import type {
  AttendanceActor,
  AttendanceState,
  AttendanceSummary,
  CheckinResult,
  RosterRoom,
  RosterView,
} from '../types'
import type { AttendanceRecordRow, AttendanceSessionRow } from '@/types/database.generated'

const HISTORY_LIMIT = 30

function summarise(records: Pick<AttendanceRecordRow, 'state'>[]): AttendanceSummary {
  const s: AttendanceSummary = { present: 0, absent: 0, excused: 0, unmarked: 0, total: records.length }
  for (const r of records) s[r.state] += 1
  return s
}

function sessionMatchesActor(session: AttendanceSessionRow, actor: AttendanceActor): boolean {
  if (session.dorm_id !== actor.dormId) return false
  if (actor.role !== 'sardor') return true
  if (session.gender && session.gender !== actor.gender) return false
  if (session.floor_number != null && session.floor_number !== actor.floor) return false
  return true
}

export function createAttendanceService(
  repo: AttendanceRepository = createAttendanceRepository(),
) {
  async function residentsForActor(actor: AttendanceActor): Promise<ResidentRow[]> {
    return repo.residents(actor.faculties, {
      floor: actor.role === 'sardor' ? actor.floor : undefined,
      gender: actor.role === 'sardor' ? actor.gender : (actor.gender ?? undefined),
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
      const room = resident.room_number ?? '—'
      if (!roomMap.has(room)) roomMap.set(room, { roomNumber: room, residents: [] })
      roomMap.get(room)!.residents.push({
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
        openedBy: actor.userId,
        closesAt: effectiveClose.toISOString(),
      })
      await repo.seedRecords(row.id, await residentsForActor(actor))
      return loadRoster(actor, row)
    },

    async roster(actor: AttendanceActor, sessionId: string): Promise<RosterView> {
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
      if (open.length === 0) return { hasOpen: false as const }
      const records = (await Promise.all(open.map((s) => repo.records(s.id)))).flat()
      return {
        hasOpen: true as const,
        closesAt: open[0].closes_at,
        summary: summarise(records),
      }
    },

    async history(actor: AttendanceActor, studentId: string) {
      if (actor.role === 'sardor') throw new ApiError(403, 'Faqat tarbiyachi yoki dekan')
      const rows = await repo.studentHistory(studentId, HISTORY_LIMIT)
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
      const dormId = await repo.dormIdForFaculty(faculty)
      if (!dormId) return { status: 'no_session' }
      const dorm = await repo.dorm(dormId)
      if (!dorm) return { status: 'no_session' }

      const open = (await repo.openSessions(dormId)).filter((s) => s.kind === 'nightly' || s.floor_number == null)
      const session = open[0]
      if (!session) return { status: 'no_session' }
      if (new Date(session.closes_at).getTime() < Date.now()) return { status: 'no_session' }

      if (dorm.latitude == null || dorm.longitude == null) return { status: 'unavailable' }

      const body = (coords ?? {}) as { lat?: unknown; lng?: unknown; accuracy?: unknown }
      const point = asCoordinate(body.lat, body.lng)
      const accuracy = Math.round(Number(body.accuracy))
      if (!point || !Number.isFinite(accuracy)) return { status: 'retry' }
      if (accuracy > 2000) return { status: 'retry' }

      const distance = haversineMeters(point, { lat: dorm.latitude, lng: dorm.longitude })
      const state: 'present' | 'absent' = distance <= dorm.checkin_radius_m ? 'present' : 'absent'

      // Ensure a row exists (cron seeds it, but be defensive).
      await repo.seedRecords(session.id, await repo.residents(await repo.facultiesForDorm(dormId), {}))

      const { applied, current } = await repo.applySelfCheckin({
        sessionId: session.id,
        studentId: userId,
        state,
        selfLat: point.lat,
        selfLng: point.lng,
        selfAccuracyM: accuracy,
        selfDistanceM: distance,
      })
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
        const residents = await repo.residents(faculties, {})
        await repo.seedRecords(row.id, residents)
        opened.push(row.id)

        await Promise.all(residents.map((r) =>
          sendPushWithoutBreaking(() => sendPushForUser(r.id, {
            title: 'Yo‘qlama boshlandi',
            body: `${dorm.attendance_close_time} gacha yotoqxonada ekanligingizni tasdiqlang.`,
            url: '/talaba/yoqlama',
            tag: `attendance-${row.id}`,
          })),
        ))
      }

      return { openedSessions: opened.length }
    },
  }
}

export type AttendanceService = ReturnType<typeof createAttendanceService>
