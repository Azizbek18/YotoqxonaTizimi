import { beforeEach, describe, expect, it, vi } from 'vitest'

const sendPushForUser = vi.fn<(userId: string, message: unknown) => Promise<void>>(async () => {})
vi.mock('@/lib/push-notifications', () => ({
  sendPushWithoutBreaking: async (fn: () => Promise<unknown>) => { await fn() },
}))
vi.mock('@/lib/notify-student', () => ({
  notifyStudent: (userId: string, message: unknown) => sendPushForUser(userId, message),
}))

const sendReminders = vi.fn(async (_targets: unknown, _info: unknown) => ({ attempted: 0 }))
const sendCaptain = vi.fn(async (_a: unknown) => undefined)
vi.mock('./dekan-notify', () => ({
  sendAttendanceReminders: (t: unknown, i: unknown) => sendReminders(t, i),
  sendCaptainAlert: (a: unknown) => sendCaptain(a),
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
    studentDormId: vi.fn(async () => null),
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

// The legacy flow's student check-in also asks for the student's own dekan
// roll-call; none is running in these cases.
const noDekan = { openForStudent: async () => null, residentOf: async () => null }

describe('block-scoped sessions', () => {
  const blockSession = (block: string | null) => ({ ...openSession, id: `sess-${block}`, kind: 'adhoc' as const, gender: 'male' as const, floor_number: 3, block })

  it('does not hand a block B captain the session opened for block A', async () => {
    const r = repo({ sessionById: vi.fn(async () => blockSession('A')) })
    await expect(createAttendanceService(r as never).roster({ ...sardor, block: 'B' }, 'sess-A'))
      .rejects.toMatchObject({ status: 404 })
  })
  it('still serves the captain of the same block, and blockless sessions to everyone', async () => {
    const same = repo({ sessionById: vi.fn(async () => blockSession('A')) })
    await expect(createAttendanceService(same as never).roster({ ...sardor, block: 'A' }, 'sess-A')).resolves.toBeTruthy()
    const shared = repo({ sessionById: vi.fn(async () => blockSession(null)) })
    await expect(createAttendanceService(shared as never).roster({ ...sardor, block: 'B' }, 'sess-null')).resolves.toBeTruthy()
  })
  it('opens an ad-hoc session stamped with the captain block', async () => {
    const r = repo()
    await createAttendanceService(r as never).openAdhoc({ ...sardor, block: 'B' })
    expect(r.upsertSession).toHaveBeenCalledWith(expect.objectContaining({ kind: 'adhoc', floor: 3, block: 'B' }))
  })
})

describe('roster', () => {
  it('keeps the same room number in different blocks and floors separate', async () => {
    const r = repo({ residents: vi.fn(async () => [
      { ...residents[0], room_number: '8', block: 'A', assigned_floor: 11 },
      { ...residents[1], room_number: '8', block: 'A', assigned_floor: 12 },
      { ...residents[2], room_number: '8', block: 'B', assigned_floor: 11 },
    ]) })
    const view = await createAttendanceService(r as never).roster(tarbiyachi, 'sess-1')
    expect(view.rooms).toHaveLength(3)
    expect(view.rooms.every((room) => room.residents.length === 1)).toBe(true)
  })
  it('limits the captain roster to their block', async () => {
    const r = repo()
    await createAttendanceService(r as never).roster({ ...sardor, block: 'B' }, 'sess-1')
    expect(r.residents).toHaveBeenCalledWith(DORM, ['amit'], { floor: 3, gender: 'male', block: 'B' })
  })
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

  it('never lets a sardor or tarbiyachi close a roll-call (dekan only)', async () => {
    const r = repo()
    const svc = createAttendanceService(r as never)
    await expect(svc.close(sardor, 'sess-1')).rejects.toMatchObject({ status: 403 })
    await expect(svc.close({ ...sardor, role: 'tarbiyachi' } as AttendanceActor, 'sess-1')).rejects.toMatchObject({ status: 403 })
    expect(r.closeSession).not.toHaveBeenCalled()
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
    const res = await createAttendanceService(r as never, noDekan as never).checkin('s1', 'amit', { lat: 41.3111, lng: 69.2401, accuracy: 25 })
    expect(res).toMatchObject({ status: 'present' })
    expect(r.applySelfCheckin).toHaveBeenCalledWith(expect.objectContaining({ state: 'present' }))
  })

  it('marks outside beyond the radius', async () => {
    const r = repo()
    const res = await createAttendanceService(r as never, noDekan as never).checkin('s1', 'amit', { lat: 41.40, lng: 69.35, accuracy: 30 })
    expect(res).toMatchObject({ status: 'outside' })
    expect((res as { distanceM: number }).distanceM).toBeGreaterThan(1000)
  })

  it('never records "absent" from a coarse (approximate-location) fix', async () => {
    const r = repo()
    // 2 km accuracy and far from the dorm: a Wi-Fi/cell guess, not evidence.
    const res = await createAttendanceService(r as never, noDekan as never).checkin('s1', 'amit', { lat: 41.40, lng: 69.35, accuracy: 2000 })
    expect(res).toEqual({ status: 'retry' })
    expect(r.applySelfCheckin).not.toHaveBeenCalled()
  })

  it('asks for a retry when the accuracy circle still reaches into the radius', async () => {
    const r = repo()
    // ~1.1 km from the dorm (radius 1000 m) with a 250 m fix: could be inside.
    const res = await createAttendanceService(r as never, noDekan as never).checkin('s1', 'amit', { lat: 41.321, lng: 69.24, accuracy: 250 })
    expect(res).toEqual({ status: 'retry' })
    expect(r.applySelfCheckin).not.toHaveBeenCalled()
  })

  it('still marks outside when a precise fix is clearly beyond the radius', async () => {
    const r = repo()
    const res = await createAttendanceService(r as never, noDekan as never).checkin('s1', 'amit', { lat: 41.321, lng: 69.24, accuracy: 20 })
    expect(res).toMatchObject({ status: 'outside' })
  })

  it('asks for a retry when accuracy is poor', async () => {
    const r = repo()
    const res = await createAttendanceService(r as never, noDekan as never).checkin('s1', 'amit', { lat: 41.311, lng: 69.24, accuracy: 5000 })
    expect(res).toEqual({ status: 'retry' })
    expect(r.applySelfCheckin).not.toHaveBeenCalled()
  })

  it('returns no_session when nothing is open', async () => {
    const r = repo({ openSessions: vi.fn(async () => []) })
    expect(await createAttendanceService(r as never, noDekan as never).checkin('s1', 'amit', { lat: 41.311, lng: 69.24, accuracy: 20 }))
      .toEqual({ status: 'no_session' })
  })

  it('does not overwrite a mark a human already made', async () => {
    const r = repo({ applySelfCheckin: vi.fn(async () => ({ applied: false, current: 'present' })) })
    const res = await createAttendanceService(r as never, noDekan as never).checkin('s1', 'amit', { lat: 41.311, lng: 69.24, accuracy: 20 })
    expect(res).toEqual({ status: 'already', state: 'present' })
  })

  it('is unavailable when the dorm has no coordinates', async () => {
    const r = repo({ dorm: vi.fn(async () => ({
      id: DORM, number: '1', name: '', floor_count: 9, latitude: null, longitude: null,
      checkin_radius_m: 1000, attendance_enabled: true, attendance_open_time: '21:00', attendance_close_time: '23:00',
    })) })
    expect(await createAttendanceService(r as never, noDekan as never).checkin('s1', 'amit', { lat: 41.311, lng: 69.24, accuracy: 20 }))
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

describe('runNightlyReminders', () => {
  const dorm = {
    id: DORM, number: '1', name: '', floor_count: 9, latitude: 41.311, longitude: 69.240,
    checkin_radius_m: 1000, attendance_enabled: true, attendance_open_time: '21:00', attendance_close_time: '23:00',
  }
  const NOW = new Date('2026-09-01T17:00:00Z')
  const dekanRepo = {
    contacts: async (ids: string[]) => ids.map((id) => ({ id })),
    telegramChats: async () => new Map([['s2', '555']]),
  }
  const sess = (last: string | null) => ({ ...openSession, closes_at: '2026-09-01T18:00:00Z', last_reminded_at: last, reminder_count: last ? 1 : 0 })
  const base = (last: string | null, claim = true) => {
    const claimNightlyReminder = vi.fn(async () => claim)
    return Object.assign(repo({
      enabledDorms: vi.fn(async () => [dorm]),
      openSessions: vi.fn(async () => [sess(last)]),
      claimNightlyReminder,
    }), { claimNightlyReminder })
  }

  it('first round goes out right away, Telegram-only (start push already sent)', async () => {
    const r = base(null)
    const out = await createAttendanceService(r as never, dekanRepo as never).runNightlyReminders(NOW)
    expect(out.reminded).toBe(1)
    expect(r.claimNightlyReminder).toHaveBeenCalled()
    expect(sendReminders).toHaveBeenCalledTimes(1)
    expect(sendReminders.mock.calls[0][1]).toMatchObject({ round: 1, skipPush: true })
  })

  it('reminds only unconfirmed residents once 5 minutes have passed', async () => {
    const r = base('2026-09-01T16:55:00Z')
    const out = await createAttendanceService(r as never, dekanRepo as never).runNightlyReminders(NOW)
    expect(out.reminded).toBe(1)
    expect(sendReminders).toHaveBeenCalledTimes(1)
    const targets = sendReminders.mock.calls[0][0] as { id: string; chatId: string | null }[]
    expect(targets).toEqual([{ id: 's2', chatId: '555' }])
    expect(sendReminders.mock.calls[0][1]).toMatchObject({ skipPush: false })
  })

  it('does nothing before the interval is up', async () => {
    const r = base('2026-09-01T16:58:00Z')
    const out = await createAttendanceService(r as never, dekanRepo as never).runNightlyReminders(NOW)
    expect(out.reminded).toBe(0)
    expect(r.claimNightlyReminder).not.toHaveBeenCalled()
  })

  it('skips when another run claimed the round, and after the window closed', async () => {
    const lost = base('2026-09-01T16:50:00Z', false)
    await createAttendanceService(lost as never, dekanRepo as never).runNightlyReminders(NOW)
    expect(sendReminders).not.toHaveBeenCalled()

    const late = base('2026-09-01T16:50:00Z')
    await createAttendanceService(late as never, dekanRepo as never).runNightlyReminders(new Date('2026-09-01T18:30:00Z'))
    expect(late.claimNightlyReminder).not.toHaveBeenCalled()
  })
})

describe('runCaptainAlerts', () => {
  const dorm = {
    id: DORM, number: '1', name: '', floor_count: 9, latitude: 41.311, longitude: 69.240,
    checkin_radius_m: 1000, attendance_enabled: true, attendance_open_time: '21:00', attendance_close_time: '23:00',
  }
  const CLOSE = '2026-09-01T18:00:00Z'
  const at = (iso: string) => new Date(iso)
  const people = [
    { id: 'a', full_name: 'Ali', room_number: '305', assigned_floor: 3, gender: 'male', block: null },
    { id: 'b', full_name: 'Vali', room_number: '312', assigned_floor: 3, gender: 'male', block: null },
    { id: 'c', full_name: 'Guli', room_number: '401', assigned_floor: 4, gender: 'male', block: null },
    { id: 'd', full_name: 'Sara', room_number: '306', assigned_floor: 3, gender: 'female', block: null },
  ]
  const captain = { id: 'cap3', full_name: 'Sardor', assigned_floor: 3, gender: 'male', block: null, captain_permissions: null }
  const dekanRepo = { telegramChats: async () => new Map([['cap3', '999']]) }
  const mk = (extra: Record<string, unknown> = {}, claim = true) => {
    const claimAlertSlot = vi.fn(async () => claim)
    return Object.assign(repo({
      enabledDorms: vi.fn(async () => [dorm]),
      openSessions: vi.fn(async () => [{ ...openSession, closes_at: CLOSE }]),
      records: vi.fn(async () => [
        { student_id: 'a', state: 'unmarked' }, { student_id: 'b', state: 'present' },
        { student_id: 'c', state: 'unmarked' }, { student_id: 'd', state: 'unmarked' },
      ]),
      residents: vi.fn(async () => people),
      captainsOf: vi.fn(async () => [captain]),
      claimAlertSlot,
      ...extra,
    }), { claimAlertSlot })
  }

  it('tells the captain only about unconfirmed students of their own floor + gender', async () => {
    const r = mk()
    const out = await createAttendanceService(r as never, dekanRepo as never).runCaptainAlerts(at('2026-09-01T17:50:00Z'))
    expect(out.alerted).toBe(1)
    expect(sendCaptain).toHaveBeenCalledWith(expect.objectContaining({
      captainId: 'cap3', chatId: '999', floor: 3, minutesLeft: 10, students: ['Ali (305)'],
    }))
  })

  it('sends once per window, and again at ~5 minutes', async () => {
    const r = mk({}, false)
    await createAttendanceService(r as never, dekanRepo as never).runCaptainAlerts(at('2026-09-01T17:50:00Z'))
    expect(sendCaptain).not.toHaveBeenCalled()

    const r5 = mk()
    await createAttendanceService(r5 as never, dekanRepo as never).runCaptainAlerts(at('2026-09-01T17:55:00Z'))
    expect(r5.claimAlertSlot).toHaveBeenCalledWith('sess-1:5')
    expect(sendCaptain).toHaveBeenCalledWith(expect.objectContaining({ minutesLeft: 5 }))
  })

  it('is silent outside the last 10 minutes and when nobody is missing', async () => {
    await createAttendanceService(mk() as never, dekanRepo as never).runCaptainAlerts(at('2026-09-01T17:40:00Z'))
    await createAttendanceService(mk() as never, dekanRepo as never).runCaptainAlerts(at('2026-09-01T18:01:00Z'))
    const none = mk({ records: vi.fn(async () => [{ student_id: 'a', state: 'present' }]) })
    await createAttendanceService(none as never, dekanRepo as never).runCaptainAlerts(at('2026-09-01T17:50:00Z'))
    expect(sendCaptain).not.toHaveBeenCalled()
  })

  it('skips a captain whose marking right was revoked', async () => {
    const revoked = mk({ captainsOf: vi.fn(async () => [{ ...captain, captain_permissions: { 'attendance.mark': false } }]) })
    await createAttendanceService(revoked as never, dekanRepo as never).runCaptainAlerts(at('2026-09-01T17:50:00Z'))
    expect(sendCaptain).not.toHaveBeenCalled()
  })
})

describe('history', () => {
  const resident: AttendanceActor = {
    userId: 's1', role: 'talaba', dormId: DORM, faculties: ['amit'], floor: null, gender: null, canWrite: false,
  }

  it('refuses a plain resident and a sardor', async () => {
    const r = repo()
    await expect(createAttendanceService(r as never).history(resident, 's2')).rejects.toMatchObject({ status: 403 })
    await expect(createAttendanceService(r as never).history(sardor, 's2')).rejects.toMatchObject({ status: 403 })
    expect(r.studentHistory).not.toHaveBeenCalled()
  })

  it('reads only sessions of the actor’s own building', async () => {
    const r = repo()
    await createAttendanceService(r as never).history(tarbiyachi, 's2')
    expect(r.studentHistory).toHaveBeenCalledWith('s2', DORM, expect.any(Number))
  })
})

describe('building scope — a faculty can live in several buildings', () => {
  it('reads the roll of the actor’s own building only', async () => {
    const r = repo()
    await createAttendanceService(r as never).roster(tarbiyachi, 'sess-1')
    // dormId is the first argument of residents(): never a faculty-only query
    expect(r.residents).toHaveBeenCalledWith(DORM, expect.any(Array), expect.anything())
  })

  it('the nightly cron seeds each building with its own residents', async () => {
    const r = repo({
      enabledDorms: vi.fn(async () => [{
        id: DORM, number: '1', name: '', floor_count: 9, latitude: 41.311, longitude: 69.240,
        checkin_radius_m: 1000, attendance_enabled: true, attendance_open_time: '21:00', attendance_close_time: '23:00',
      }]),
    })
    await createAttendanceService(r as never).runNightlyCron(new Date('2026-09-01T16:10:00Z'))
    expect(r.residents).toHaveBeenCalledWith(DORM, expect.any(Array), expect.anything())
  })

  it('a student checks in against the building they are housed in, not the faculty’s primary', async () => {
    const OTHER = 'dorm-3'
    const r = repo({
      studentDormId: vi.fn(async () => OTHER),
      openSessions: vi.fn(async () => [{ ...openSession, dorm_id: OTHER }]),
    })
    await createAttendanceService(r as never, noDekan as never).checkin('s1', 'amit', { lat: 41.3111, lng: 69.2401, accuracy: 25 })
    expect(r.dorm).toHaveBeenCalledWith(OTHER)
    expect(r.openSessions).toHaveBeenCalledWith(OTHER)
    expect(r.dormIdForFaculty).not.toHaveBeenCalled()
  })

  it('falls back to the faculty’s primary building for a student with no dorm yet', async () => {
    const r = repo()
    await createAttendanceService(r as never, noDekan as never).checkin('s1', 'amit', { lat: 41.3111, lng: 69.2401, accuracy: 25 })
    expect(r.dormIdForFaculty).toHaveBeenCalledWith('amit')
  })
})
