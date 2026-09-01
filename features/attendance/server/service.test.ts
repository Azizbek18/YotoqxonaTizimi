import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendPushForUser = vi.fn<(userId: string, message: unknown) => Promise<void>>(async () => {})
vi.mock('@/lib/push-notifications', () => ({
  sendPushForUser: (userId: string, message: unknown) => sendPushForUser(userId, message),
  sendPushWithoutBreaking: async (fn: () => Promise<unknown>) => { await fn() },
}))

const { createAttendanceService } = await import('./service')
import type { AttendanceActor } from '../types'

const DORM = 'dorm-1'
const sardor: AttendanceActor = {
  userId: 'cap-1', role: 'sardor', dormId: DORM, faculties: ['amit'], floor: 3, gender: 'male', canWrite: true,
}
const tarbiyachi: AttendanceActor = {
  userId: 'tar-1', role: 'tarbiyachi', dormId: DORM, faculties: ['amit', 'biologiya'], floor: null, gender: null, canWrite: true,
}
const dekan: AttendanceActor = {
  userId: 'dek-1', role: 'dekan', dormId: DORM, faculties: ['amit'], floor: null, gender: null, canWrite: false,
}

const residents = [
  { id: 's1', full_name: 'Ali', avatar_url: null, room_number: '305', assigned_floor: 3, gender: 'male', faculty: 'amit' },
  { id: 's2', full_name: 'Vali', avatar_url: null, room_number: '305', assigned_floor: 3, gender: 'male', faculty: 'amit' },
  { id: 's3', full_name: 'Guli', avatar_url: null, room_number: '312', assigned_floor: 3, gender: 'male', faculty: 'amit' },
]

const openSession = {
  id: 'sess-1', dorm_id: DORM, scheduled_for: '2026-09-01', kind: 'nightly' as const,
  gender: null, floor_number: null, opened_by: null, opened_at: '2026-09-01T16:00:00Z',
  closes_at: '2100-01-01T00:00:00Z', closed_by: null, closed_at: null, status: 'open' as const,
  created_at: '2026-09-01T16:00:00Z',
}

function repo(overrides: Record<string, unknown> = {}) {
  return {
    dormIdForFaculty: vi.fn(async () => DORM),
    facultiesForDorm: vi.fn(async () => ['amit', 'biologiya']),
    dorm: vi.fn(async () => ({
      id: DORM, number: '1', name: 'TTJ 1', floor_count: 9,
      latitude: 41.311, longitude: 69.240, checkin_radius_m: 1000,
      attendance_enabled: true, attendance_open_time: '21:00', attendance_close_time: '23:00',
    })),
    enabledDorms: vi.fn(async () => []),
    residents: vi.fn(async () => residents),
    openSessions: vi.fn(async () => [openSession]),
    sessionById: vi.fn(async () => openSession),
    upsertSession: vi.fn(async () => ({ row: openSession, created: true })),
    seedRecords: vi.fn(async () => undefined),
    records: vi.fn(async () => [
      { student_id: 's1', state: 'present', source: 'self_location', soft_flag: false, self_distance_m: 40 },
      { student_id: 's2', state: 'unmarked', source: null, soft_flag: false, self_distance_m: null },
    ]),
    setRecordState: vi.fn(async () => ({ id: 'r1', state: 'absent', soft_flag: true })),
    applySelfCheckin: vi.fn(async () => ({ applied: true, current: 'present' })),
    closeSession: vi.fn(async () => undefined),
    autoCloseExpired: vi.fn(async () => undefined),
    recordById: vi.fn(),
    createWarning: vi.fn(async () => ({ warning_id: 'w1', new_warning_count: 2 })),
    clearFlag: vi.fn(async () => undefined),
    flaggedRecords: vi.fn(async () => []),
    studentHistory: vi.fn(async () => []),
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('roster', () => {
  it('groups residents by room and counts states', async () => {
    const r = repo()
    const view = await createAttendanceService(r as never).roster(sardor, 'sess-1')
    expect(view.rooms.map((x) => x.roomNumber)).toEqual(['305', '312'])
    expect(view.rooms[0].residents).toHaveLength(2)
    expect(view.summary).toMatchObject({ present: 1, unmarked: 2, total: 3 })
    expect(view.canWrite).toBe(true)
  })

  it('lazily auto-closes a session past its close time', async () => {
    const expired = { ...openSession, closes_at: '2000-01-01T00:00:00Z' }
    const r = repo({ sessionById: vi.fn(async () => expired) })
    const view = await createAttendanceService(r as never).roster(tarbiyachi, 'sess-1')
    expect(r.closeSession).toHaveBeenCalledWith('sess-1', 'auto_closed', null)
    expect(view.session.status).toBe('auto_closed')
    expect(view.canWrite).toBe(false)
  })
})

describe('mark', () => {
  it('flags an unexplained absence and stamps the source by role', async () => {
    const r = repo()
    await createAttendanceService(r as never).mark(sardor, 'sess-1', 's3', 'absent')
    expect(r.setRecordState).toHaveBeenCalledWith(expect.objectContaining({
      studentId: 's3', state: 'absent', source: 'captain', softFlag: true,
    }))
  })

  it('does not flag an excused absence', async () => {
    const r = repo()
    await createAttendanceService(r as never).mark(tarbiyachi, 'sess-1', 's3', 'excused')
    expect(r.setRecordState).toHaveBeenCalledWith(expect.objectContaining({
      state: 'excused', source: 'tarbiyachi', softFlag: false,
    }))
  })

  it('rejects a student outside the actor scope', async () => {
    const r = repo({ residents: vi.fn(async () => []) })
    await expect(createAttendanceService(r as never).mark(sardor, 'sess-1', 'ghost', 'present'))
      .rejects.toThrow(/kirmaydi/)
  })

  it('rejects marking on a closed session', async () => {
    const r = repo({ sessionById: vi.fn(async () => ({ ...openSession, status: 'closed' })) })
    await expect(createAttendanceService(r as never).mark(sardor, 'sess-1', 's1', 'present'))
      .rejects.toMatchObject({ status: 409 })
  })

  it('forbids a read-only dekan from marking', async () => {
    await expect(createAttendanceService(repo() as never).mark(dekan, 'sess-1', 's1', 'present'))
      .rejects.toMatchObject({ status: 403 })
  })
})

describe('activeSessions scope', () => {
  it('hides another gender/floor session from a sardor', async () => {
    const r = repo({ openSessions: vi.fn(async () => [
      { ...openSession, id: 'a', gender: 'female', floor_number: null },
      { ...openSession, id: 'b', gender: null, floor_number: 5 },
      { ...openSession, id: 'c', gender: 'male', floor_number: 3 },
      { ...openSession, id: 'd', gender: null, floor_number: null },
    ]) })
    const list = await createAttendanceService(r as never).activeSessions(sardor)
    expect(list.map((s) => s.id).sort()).toEqual(['c', 'd'])
  })

  it('shows a tarbiyachi every open session in the building', async () => {
    const r = repo({ openSessions: vi.fn(async () => [
      { ...openSession, id: 'a', gender: 'female' },
      { ...openSession, id: 'b', floor_number: 7 },
    ]) })
    const list = await createAttendanceService(r as never).activeSessions(tarbiyachi)
    expect(list).toHaveLength(2)
  })
})

describe('openAdhoc', () => {
  it('needs write access and seeds records', async () => {
    const r = repo()
    await createAttendanceService(r as never).openAdhoc(tarbiyachi)
    expect(r.upsertSession).toHaveBeenCalledWith(expect.objectContaining({ kind: 'adhoc', openedBy: 'tar-1' }))
    expect(r.seedRecords).toHaveBeenCalled()
    await expect(createAttendanceService(r as never).openAdhoc(dekan)).rejects.toMatchObject({ status: 403 })
  })
})

describe('checkin', () => {
  it('marks present inside the radius', async () => {
    const r = repo()
    const res = await createAttendanceService(r as never).checkin('s1', 'amit', { lat: 41.3111, lng: 69.2401, accuracy: 25 })
    expect(res).toMatchObject({ status: 'present' })
    expect(r.applySelfCheckin).toHaveBeenCalledWith(expect.objectContaining({ state: 'present' }))
  })

  it('marks outside beyond the radius', async () => {
    const r = repo()
    const res = await createAttendanceService(r as never).checkin('s1', 'amit', { lat: 41.40, lng: 69.35, accuracy: 30 })
    expect(res).toMatchObject({ status: 'outside' })
    expect((res as { distanceM: number }).distanceM).toBeGreaterThan(1000)
  })

  it('asks for a retry when accuracy is poor', async () => {
    const r = repo()
    const res = await createAttendanceService(r as never).checkin('s1', 'amit', { lat: 41.311, lng: 69.24, accuracy: 5000 })
    expect(res).toEqual({ status: 'retry' })
    expect(r.applySelfCheckin).not.toHaveBeenCalled()
  })

  it('returns no_session when nothing is open', async () => {
    const r = repo({ openSessions: vi.fn(async () => []) })
    expect(await createAttendanceService(r as never).checkin('s1', 'amit', { lat: 41.311, lng: 69.24, accuracy: 20 }))
      .toEqual({ status: 'no_session' })
  })

  it('does not overwrite a mark a human already made', async () => {
    const r = repo({ applySelfCheckin: vi.fn(async () => ({ applied: false, current: 'present' })) })
    const res = await createAttendanceService(r as never).checkin('s1', 'amit', { lat: 41.311, lng: 69.24, accuracy: 20 })
    expect(res).toEqual({ status: 'already', state: 'present' })
  })

  it('is unavailable when the dorm has no coordinates', async () => {
    const r = repo({ dorm: vi.fn(async () => ({
      id: DORM, number: '1', name: '', floor_count: 9, latitude: null, longitude: null,
      checkin_radius_m: 1000, attendance_enabled: true, attendance_open_time: '21:00', attendance_close_time: '23:00',
    })) })
    expect(await createAttendanceService(r as never).checkin('s1', 'amit', { lat: 41.311, lng: 69.24, accuracy: 20 }))
      .toEqual({ status: 'unavailable' })
  })
})

describe('runNightlyCron', () => {
  const dormAt = (open: string) => ({
    id: DORM, number: '1', name: '', floor_count: 9, latitude: 41.311, longitude: 69.240,
    checkin_radius_m: 1000, attendance_enabled: true, attendance_open_time: open, attendance_close_time: '23:00',
  })
  // 2026-09-01T16:10:00Z == 21:10 Toshkent — 10 min into a 21:00 window
  const justOpened = new Date('2026-09-01T16:10:00Z')
  const midWindow = new Date('2026-09-01T17:30:00Z') // 22:30 Toshkent

  it('opens the session and pushes only in the grace window', async () => {
    const r = repo({ enabledDorms: vi.fn(async () => [dormAt('21:00')]) })
    const out = await createAttendanceService(r as never).runNightlyCron(justOpened)
    expect(out.openedSessions).toBe(1)
    expect(r.seedRecords).toHaveBeenCalled()
    expect(sendPushForUser).toHaveBeenCalledTimes(residents.length)
  })

  it('does nothing later in the window', async () => {
    const r = repo({ enabledDorms: vi.fn(async () => [dormAt('21:00')]) })
    const out = await createAttendanceService(r as never).runNightlyCron(midWindow)
    expect(out.openedSessions).toBe(0)
    expect(sendPushForUser).not.toHaveBeenCalled()
  })

  it('does not re-push when the nightly session already existed', async () => {
    const r = repo({
      enabledDorms: vi.fn(async () => [dormAt('21:00')]),
      upsertSession: vi.fn(async () => ({ row: openSession, created: false })),
    })
    const out = await createAttendanceService(r as never).runNightlyCron(justOpened)
    expect(out.openedSessions).toBe(0)
    expect(sendPushForUser).not.toHaveBeenCalled()
  })

  it('auto-closes expired sessions every run', async () => {
    const r = repo({ enabledDorms: vi.fn(async () => [dormAt('21:00')]) })
    await createAttendanceService(r as never).runNightlyCron(midWindow)
    expect(r.autoCloseExpired).toHaveBeenCalledWith(DORM)
  })
})
