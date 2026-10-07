import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { createDekanAttendanceService } = await import('./dekan-service')
const { createAttendanceService } = await import('./service')

const NOW = new Date('2026-10-05T15:00:00Z')
const min = (n: number) => new Date(NOW.getTime() + n * 60_000).toISOString()

const D1 = '11111111-1111-4111-8111-111111111111' // AMIT's dorm
const D2 = '22222222-2222-4222-8222-222222222222' // somebody else's dorm
const scope = { userId: 'dekan-1', faculty: 'amit' }

type Student = {
  id: string; faculty: string; dorm: string; room: string; floor: number
  email?: string | null; chat?: string | null; moved?: boolean
}

function setup(opts: { students?: Student[]; geo?: boolean } = {}) {
  const students: Student[] = opts.students ?? [
    { id: 's1', faculty: 'amit', dorm: D1, room: '101', floor: 1, email: 's1@x.uz', chat: '111' },
    { id: 's2', faculty: 'amit', dorm: D1, room: '102', floor: 1, email: 's2@x.uz', chat: null },
    { id: 's3', faculty: 'amit', dorm: D1, room: '201', floor: 2, email: null, chat: null },
    // Same dorm, DIFFERENT faculty — must never appear in AMIT's roll.
    { id: 'x1', faculty: 'iqtisodiyot', dorm: D1, room: '103', floor: 1, email: 'x1@x.uz', chat: '999' },
    // Same faculty, DIFFERENT dorm — must never appear in dorm D1's roll.
    { id: 'y1', faculty: 'amit', dorm: D2, room: '501', floor: 5, email: 'y1@x.uz', chat: '888' },
  ]
  type Sess = { id: string; dorm_id: string; faculty: string; status: string; starts_at: string; closes_at: string; closed_at: string | null; last_reminded_at: string | null; reminder_count: number; [k: string]: unknown }
  const sessions: Sess[] = []
  const records = new Map<string, Map<string, { student_id: string; state: string; room_number: string; floor_number: number | null; self_distance_m: number | null; marked_at: string | null }>>()
  const sent: { ids: string[]; round: number; dorm: string }[] = []
  let seq = 0

  const inScope = (dorm: string, faculty: string) =>
    students.filter((s) => s.dorm === dorm && s.faculty === faculty && !s.moved)
  const toResident = (s: Student) => ({
    id: s.id, full_name: `Talaba ${s.id}`, avatar_url: null, room_number: s.room,
    assigned_floor: s.floor, gender: 'male', faculty: s.faculty,
  })

  const repo = {
    seedRecords: vi.fn(async (sessionId: string, residents: { id: string; room_number: string | null; assigned_floor: number | null }[]) => {
      const m = records.get(sessionId) ?? new Map()
      for (const r of residents) {
        if (!m.has(r.id)) m.set(r.id, { student_id: r.id, state: 'unmarked', room_number: r.room_number ?? '', floor_number: r.assigned_floor, self_distance_m: null, marked_at: null })
      }
      records.set(sessionId, m)
    }),
    applySelfCheckin: vi.fn(async (input: { sessionId: string; studentId: string; state: 'present' | 'absent'; selfDistanceM: number }) => {
      const rec = records.get(input.sessionId)?.get(input.studentId)
      if (rec) { rec.state = input.state; rec.self_distance_m = input.selfDistanceM }
      return { applied: true, current: input.state }
    }),
  }

  const drepo = {
    residentCountsByDorm: vi.fn(async (faculty: string) => {
      const m = new Map<string, number>()
      for (const s of students.filter((x) => x.faculty === faculty && !x.moved)) m.set(s.dorm, (m.get(s.dorm) ?? 0) + 1)
      return m
    }),
    dorms: vi.fn(async (ids: string[]) =>
      [{ id: D1, number: '3', name: 'yotoqxona', latitude: opts.geo === false ? null : 41.3, longitude: opts.geo === false ? null : 69.2 },
       { id: D2, number: '7', name: 'yotoqxona', latitude: 41.4, longitude: 69.3 }].filter((d) => ids.includes(d.id))),
    residents: vi.fn(async (dorm: string, faculty: string) => inScope(dorm, faculty).map(toResident)),
    residentOf: vi.fn(async (id: string, dorm: string, faculty: string) => {
      const s = inScope(dorm, faculty).find((x) => x.id === id)
      return s ? toResident(s) : null
    }),
    contacts: vi.fn(async (ids: string[]) =>
      students.filter((s) => ids.includes(s.id)).map((s) => ({
        id: s.id, full_name: `Talaba ${s.id}`, email: s.email ?? null, phone: null, phone_number: null,
        room_number: s.room, assigned_floor: s.floor,
      }))),
    telegramChats: vi.fn(async (ids: string[]) => {
      const m = new Map<string, string>()
      for (const s of students) if (ids.includes(s.id) && s.chat) m.set(s.id, s.chat)
      return m
    }),
    sessionForFaculty: vi.fn(async (id: string, faculty: string) =>
      sessions.find((s) => s.id === id && s.faculty === faculty) ?? null),
    sessionById: vi.fn(async (id: string) => sessions.find((s) => s.id === id) ?? null),
    activeFor: vi.fn(),
    openForStudent: vi.fn(async (dorm: string, faculty: string) =>
      sessions.find((s) => s.dorm_id === dorm && s.faculty === faculty && s.status === 'open') ?? null),
    recentFor: vi.fn(async (faculty: string) =>
      sessions.filter((s) => s.faculty === faculty && s.status !== 'open' && s.status !== 'scheduled')),
    activeForFaculty: vi.fn(async (faculty: string) =>
      sessions.filter((s) => s.faculty === faculty && (s.status === 'open' || s.status === 'scheduled'))),
    insertSession: vi.fn(async (i: { dormId: string; faculty: string; startsAt: string; closesAt: string; status: string; openedBy: string; reminded: boolean }) => {
      if (sessions.some((s) => s.dorm_id === i.dormId && s.faculty === i.faculty && (s.status === 'open' || s.status === 'scheduled'))) {
        return { row: null, conflict: true }
      }
      const row = {
        id: `sess-${++seq}`, dorm_id: i.dormId, faculty: i.faculty, kind: 'dekan', starts_at: i.startsAt,
        closes_at: i.closesAt, status: i.status, closed_at: null, reminder_interval_min: 10,
        last_reminded_at: i.reminded ? NOW.toISOString() : null, reminder_count: i.reminded ? 1 : 0,
      }
      sessions.push(row)
      return { row, conflict: false }
    }),
    records: vi.fn(async (id: string) => [...(records.get(id)?.values() ?? [])]),
    sessionsInRange: vi.fn(async (faculty: string, dorm: string | null, from: string, to: string) =>
      sessions.filter((s) =>
        s.faculty === faculty && (!dorm || s.dorm_id === dorm) && s.status !== 'scheduled'
        && String(s.scheduled_for) >= from && String(s.scheduled_for) <= to)),
    nightlySessionsInRange: vi.fn(async (dorms: string[], from: string, to: string) =>
      sessions.filter((s) =>
        s.kind === 'nightly' && dorms.includes(s.dorm_id)
        && String(s.scheduled_for) >= from && String(s.scheduled_for) <= to)),
    facultyStudentIds: vi.fn(async (faculty: string, ids: string[]) =>
      new Set(students.filter((s) => s.faculty === faculty && ids.includes(s.id)).map((s) => s.id))),
    recordsForSessions: vi.fn(async (ids: string[]) =>
      ids.flatMap((id) => [...(records.get(id)?.values() ?? [])].map((r) => ({ ...r, session_id: id })))),
    promote: vi.fn(async (id: string) => {
      const s = sessions.find((x) => x.id === id && x.status === 'scheduled')
      if (!s) return null
      s.status = 'open'; s.last_reminded_at = NOW.toISOString(); s.reminder_count = 1
      return s
    }),
    close: vi.fn(async (id: string, status: string) => {
      const s = sessions.find((x) => x.id === id && (x.status === 'open' || x.status === 'scheduled'))
      if (!s) return false
      s.status = status; s.closed_at = NOW.toISOString()
      return true
    }),
    dueToStart: vi.fn(async (now: Date) => sessions.filter((s) => s.status === 'scheduled' && new Date(s.starts_at) <= now)),
    openSessions: vi.fn(async () => sessions.filter((s) => s.status === 'open')),
    claimReminder: vi.fn(async (s: Sess, now: Date) => {
      const cur = sessions.find((x) => x.id === s.id)!
      if (cur.last_reminded_at !== s.last_reminded_at) return false
      cur.last_reminded_at = now.toISOString(); cur.reminder_count += 1
      return true
    }),
  }

  const send = vi.fn(async (targets: { id: string }[], info: { round: number; dormLabel: string }) => {
    sent.push({ ids: targets.map((t) => t.id).sort(), round: info.round, dorm: info.dormLabel })
    return { attempted: targets.length }
  })

  const service = createDekanAttendanceService({
    repo: repo as never, drepo: drepo as never, send, now: () => NOW,
  })
  return { service, repo, drepo, send, sent, sessions, records, students }
}

describe('history (kunlar bo‘yicha)', () => {
  const rec = (id: string, state: string) => ({ student_id: id, state, room_number: '1', floor_number: 1, self_distance_m: null, marked_at: null })
  const addSession = (t: ReturnType<typeof setup>, id: string, date: string, status: string, faculty = 'amit', dorm = D1) => {
    t.sessions.push({
      id, dorm_id: dorm, faculty, status, scheduled_for: date, starts_at: `${date}T16:00:00Z`,
      closes_at: `${date}T18:00:00Z`, closed_at: null, last_reminded_at: null, reminder_count: 0,
    })
  }

  it('summarises each day, keeps days without a roll-call empty and takes the best state per student', async () => {
    const t = setup()
    addSession(t, 'a', '2026-10-05', 'closed')
    addSession(t, 'b', '2026-10-05', 'auto_closed') // a second roll-call the same evening
    addSession(t, 'c', '2026-10-03', 'closed')
    t.records.set('a', new Map([['s1', rec('s1', 'unmarked')], ['s2', rec('s2', 'absent')]]))
    t.records.set('b', new Map([['s1', rec('s1', 'present')], ['s2', rec('s2', 'unmarked')]]))
    t.records.set('c', new Map([['s1', rec('s1', 'absent')]]))

    const view = await t.service.history(scope, { days: 4 })

    expect(view.dates).toEqual(['2026-10-05', '2026-10-04', '2026-10-03', '2026-10-02'])
    expect(view.days.map((d) => d.summary.total)).toEqual([2, 0, 1, 0])
    expect(view.days[0].summary).toMatchObject({ present: 1, absent: 1, unmarked: 0 })
    expect(view.days[0].sessionIds.sort()).toEqual(['a', 'b'])
    const s1 = view.students.find((s) => s.id === 's1')!
    expect(s1.states).toEqual({ '2026-10-05': 'present', '2026-10-03': 'absent' })
    expect(s1).toMatchObject({ present: 1, absent: 1, unmarked: 0 })
    expect(view.students.find((s) => s.id === 's2')!.states['2026-10-05']).toBe('absent')
  })

  it('only ever reads this faculty, optionally narrowed to one dorm, and clamps the range', async () => {
    const t = setup()
    addSession(t, 'mine', '2026-10-05', 'closed')
    addSession(t, 'other-faculty', '2026-10-05', 'closed', 'iqtisodiyot')
    addSession(t, 'other-dorm', '2026-10-05', 'closed', 'amit', D2)
    t.records.set('mine', new Map([['s1', rec('s1', 'present')]]))
    t.records.set('other-faculty', new Map([['x1', rec('x1', 'present')]]))
    t.records.set('other-dorm', new Map([['y1', rec('y1', 'present')]]))

    const all = await t.service.history(scope, { days: 1000 })
    expect(all.dates).toHaveLength(31)
    expect(all.students.map((s) => s.id).sort()).toEqual(['s1', 'y1'])

    const one = await t.service.history(scope, { dormId: D1, days: 7 })
    expect(one.students.map((s) => s.id)).toEqual(['s1'])
  })

  it('reports a running roll-call as live', async () => {
    const t = setup()
    t.sessions.push({
      id: 'now', dorm_id: D1, faculty: 'amit', status: 'open', scheduled_for: '2026-10-05',
      starts_at: min(-10), closes_at: min(50), closed_at: null, last_reminded_at: null, reminder_count: 0,
    })
    t.records.set('now', new Map([['s1', rec('s1', 'unmarked')]]))
    expect((await t.service.history(scope, { days: 1 })).days[0].live).toBe(true)
  })
})

describe('history includes the automatic nightly roll-call', () => {
  const rec = (id: string, state: string) => ({ student_id: id, state, room_number: '1', floor_number: 1, self_distance_m: null, marked_at: null })
  const addNightly = (t: ReturnType<typeof setup>, id: string, date: string, dorm = D1) => {
    t.sessions.push({
      id, dorm_id: dorm, faculty: null as never, kind: 'nightly', status: 'closed', scheduled_for: date,
      starts_at: null as never, closes_at: `${date}T18:00:00Z`, closed_at: null, last_reminded_at: null, reminder_count: 0,
    })
  }

  it('counts the nightly roll-call for the dekan, only for this faculty students', async () => {
    const t = setup()
    addNightly(t, 'night', '2026-10-05')
    // The nightly roll covers the whole dorm: AMIT's s1/s2 and another faculty's x1.
    t.records.set('night', new Map([['s1', rec('s1', 'present')], ['s2', rec('s2', 'unmarked')], ['x1', rec('x1', 'present')]]))

    const view = await t.service.history(scope, { days: 1 })

    expect(view.days[0]).toMatchObject({ nightly: true, sessionIds: [] })
    expect(view.days[0].summary).toMatchObject({ present: 1, unmarked: 1, total: 2 })
    expect(view.students.map((s) => s.id).sort()).toEqual(['s1', 's2'])
  })

  it('ignores nightly roll-calls of dorms the faculty does not live in', async () => {
    const t = setup()
    addNightly(t, 'elsewhere', '2026-10-05', 'dorm-other')
    t.records.set('elsewhere', new Map([['s1', rec('s1', 'present')]]))
    const view = await t.service.history(scope, { days: 1 })
    expect(view.days[0]).toMatchObject({ nightly: false, summary: { total: 0 } })
  })

  it('merges with the dekan own roll-call, which stays openable', async () => {
    const t = setup()
    addNightly(t, 'night', '2026-10-05')
    t.sessions.push({
      id: 'mine', dorm_id: D1, faculty: 'amit', status: 'closed', scheduled_for: '2026-10-05',
      starts_at: '2026-10-05T16:00:00Z', closes_at: '2026-10-05T18:00:00Z', closed_at: null, last_reminded_at: null, reminder_count: 0,
    })
    t.records.set('night', new Map([['s1', rec('s1', 'unmarked')], ['s2', rec('s2', 'present')]]))
    t.records.set('mine', new Map([['s1', rec('s1', 'present')]]))
    const day = (await t.service.history(scope, { days: 1 })).days[0]
    expect(day).toMatchObject({ nightly: true, sessionIds: ['mine'] })
    expect(day.summary).toMatchObject({ present: 2, total: 2 })
  })
})

describe('create', () => {
  it('starts now: open session seeded with ONLY this faculty + dorm', async () => {
    const t = setup()
    const { session, startedNow } = await t.service.create(scope, { dormId: D1, closesAt: min(60) })
    expect(startedNow).toBe(true)
    expect(session.status).toBe('open')
    expect(session.summary).toMatchObject({ unmarked: 3, total: 3 })
    expect([...t.records.get(session.id)!.keys()].sort()).toEqual(['s1', 's2', 's3'])
  })

  it('schedules a future start without seeding or notifying', async () => {
    const t = setup()
    const { session, startedNow } = await t.service.create(scope, { dormId: D1, startsAt: min(120), closesAt: min(180) })
    expect(startedNow).toBe(false)
    expect(session.status).toBe('scheduled')
    expect(t.repo.seedRecords).not.toHaveBeenCalled()
    expect(t.send).not.toHaveBeenCalled()
  })

  it("403s a dorm the faculty has no residents in (another building's roll)", async () => {
    const t = setup()
    await expect(t.service.create({ ...scope, faculty: 'iqtisodiyot' }, { dormId: D2, closesAt: min(60) }))
      .rejects.toMatchObject({ status: 403 })
  })

  it('409s when the building has no GPS point', async () => {
    const t = setup({ geo: false })
    await expect(t.service.create(scope, { dormId: D1, closesAt: min(60) }))
      .rejects.toMatchObject({ status: 409, code: 'DORM_GEO_MISSING' })
  })

  it('409s a second active roll-call for the same dorm + faculty', async () => {
    const t = setup()
    await t.service.create(scope, { dormId: D1, closesAt: min(60) })
    await expect(t.service.create(scope, { dormId: D1, closesAt: min(90) }))
      .rejects.toMatchObject({ status: 409, code: 'SESSION_EXISTS' })
  })

  it('lets the same faculty run separate roll-calls in two dorms', async () => {
    const t = setup()
    await t.service.create(scope, { dormId: D1, closesAt: min(60) })
    const second = await t.service.create(scope, { dormId: D2, closesAt: min(60) })
    expect([...t.records.get(second.session.id)!.keys()]).toEqual(['y1'])
  })

  it.each([
    ['too short', min(5)],
    ['in the past', min(-5)],
    ['over 12h', min(13 * 60)],
    ['garbage', 'not-a-date'],
  ])('rejects a %s window', async (_n, closesAt) => {
    const t = setup()
    await expect(t.service.create(scope, { dormId: D1, closesAt })).rejects.toMatchObject({ status: 400 })
  })
})

describe('overview', () => {
  it('lists dorms of the faculty only and hides a roll-call cancelled before it opened', async () => {
    const t = setup()
    const { session } = await t.service.create(scope, { dormId: D1, startsAt: min(120), closesAt: min(180) })
    await t.service.close(scope, session.id) // cancelled while still scheduled
    const view = await t.service.overview(scope)
    expect(view.dorms.map((d) => d.id).sort()).toEqual([D1, D2].sort())
    expect(view.dorms.every((d) => d.active === null)).toBe(true)
    expect(view.recent).toEqual([])
  })

  it("never shows another faculty's dorm", async () => {
    const t = setup()
    const view = await t.service.overview({ userId: 'dekan-2', faculty: 'iqtisodiyot' })
    expect(view.dorms.map((d) => d.id)).toEqual([D1])
  })
})

describe('roster / close isolation', () => {
  it("404s another faculty's session (no existence leak)", async () => {
    const t = setup()
    const { session } = await t.service.create(scope, { dormId: D1, closesAt: min(60) })
    const other = { userId: 'dekan-2', faculty: 'iqtisodiyot' }
    await expect(t.service.roster(other, session.id)).rejects.toMatchObject({ status: 404 })
    await expect(t.service.close(other, session.id)).rejects.toMatchObject({ status: 404 })
    expect(t.sessions[0].status).toBe('open')
  })

  it('live roster drops a student who moved out and picks up a late arrival', async () => {
    const t = setup()
    const { session } = await t.service.create(scope, { dormId: D1, closesAt: min(60) })
    t.students.find((s) => s.id === 's3')!.moved = true
    t.students.push({ id: 's4', faculty: 'amit', dorm: D1, room: '104', floor: 1 })
    const view = await t.service.roster(scope, session.id)
    expect(view.residents.map((r) => r.id).sort()).toEqual(['s1', 's2', 's4'])
  })

  it('reports present / absent / unmarked from student check-ins', async () => {
    const t = setup()
    const { session } = await t.service.create(scope, { dormId: D1, closesAt: min(60) })
    await t.repo.applySelfCheckin({ sessionId: session.id, studentId: 's1', state: 'present', selfDistanceM: 40 })
    await t.repo.applySelfCheckin({ sessionId: session.id, studentId: 's2', state: 'absent', selfDistanceM: 5200 })
    const view = await t.service.roster(scope, session.id)
    expect(view.session.summary).toMatchObject({ present: 1, absent: 1, unmarked: 1, total: 3 })
  })

  it('close ends it once; a second close is a no-op', async () => {
    const t = setup()
    const { session } = await t.service.create(scope, { dormId: D1, closesAt: min(60) })
    expect(await t.service.close(scope, session.id)).toEqual({ ok: true, already: false })
    expect(await t.service.close(scope, session.id)).toEqual({ ok: true, already: true })
  })

  it('a roster read after the window ran out auto-closes it', async () => {
    const t = setup()
    const { session } = await t.service.create(scope, { dormId: D1, closesAt: min(30) })
    t.sessions[0].closes_at = min(-1)
    const view = await t.service.roster(scope, session.id)
    expect(view.session.status).toBe('auto_closed')
  })
})

describe('deliverStart', () => {
  it('reminds only people who have not confirmed, never another faculty or dorm', async () => {
    const t = setup()
    const { session } = await t.service.create(scope, { dormId: D1, closesAt: min(60) })
    await t.repo.applySelfCheckin({ sessionId: session.id, studentId: 's1', state: 'present', selfDistanceM: 10 })
    await t.service.deliverStart(session.id)
    expect(t.sent).toEqual([{ ids: ['s2', 's3'], round: 1, dorm: '3-yotoqxona' }])
  })

  it('does nothing for a session that is not open', async () => {
    const t = setup()
    const { session } = await t.service.create(scope, { dormId: D1, startsAt: min(60), closesAt: min(120) })
    await t.service.deliverStart(session.id)
    expect(t.send).not.toHaveBeenCalled()
  })
})

describe('runCron', () => {
  it('opens a due scheduled session once and announces it', async () => {
    const t = setup()
    const { session } = await t.service.create(scope, { dormId: D1, startsAt: min(120), closesAt: min(180) })
    t.sessions[0].starts_at = min(-1) // its time has come
    t.sessions[0].closes_at = min(59)
    expect(await t.service.runCron()).toMatchObject({ started: 1 })
    expect(t.sessions[0].status).toBe('open')
    expect(t.sent).toHaveLength(1)
    expect(t.sent[0]).toMatchObject({ ids: ['s1', 's2', 's3'], round: 1 })
    // A second tick (or a racing run) must not announce again.
    expect(await t.service.runCron()).toMatchObject({ started: 0 })
    expect(t.sent).toHaveLength(1)
    expect(session.id).toBe(t.sessions[0].id)
  })

  it("closes a scheduled session whose whole window was missed instead of opening it", async () => {
    const t = setup()
    await t.service.create(scope, { dormId: D1, startsAt: min(120), closesAt: min(180) })
    t.sessions[0].starts_at = min(-60)
    t.sessions[0].closes_at = min(-10)
    expect(await t.service.runCron()).toMatchObject({ started: 0, closed: 1 })
    expect(t.sessions[0].status).toBe('auto_closed')
    expect(t.send).not.toHaveBeenCalled()
  })

  it('sends a reminder only once the 5-minute interval is up', async () => {
    const t = setup()
    await t.service.create(scope, { dormId: D1, closesAt: min(90) })
    // Just created (round 1 already queued by the route): nothing is due yet.
    expect(await t.service.runCron()).toMatchObject({ reminded: 0 })

    t.sessions[0].last_reminded_at = min(-10)
    expect(await t.service.runCron()).toMatchObject({ reminded: 1 })
    expect(t.sent).toEqual([{ ids: ['s1', 's2', 's3'], round: 2, dorm: '3-yotoqxona' }])

    // Same minute again: the claim moved last_reminded_at, so no double send.
    expect(await t.service.runCron()).toMatchObject({ reminded: 0 })
    expect(t.sent).toHaveLength(1)
  })

  it('skips the reminder when another run already claimed it', async () => {
    const t = setup()
    await t.service.create(scope, { dormId: D1, closesAt: min(90) })
    t.sessions[0].last_reminded_at = min(-15)
    t.drepo.claimReminder.mockResolvedValueOnce(false)
    expect(await t.service.runCron()).toMatchObject({ reminded: 0 })
    expect(t.send).not.toHaveBeenCalled()
  })

  it('auto-closes an open session whose window ended', async () => {
    const t = setup()
    await t.service.create(scope, { dormId: D1, closesAt: min(30) })
    t.sessions[0].closes_at = min(-1)
    expect(await t.service.runCron()).toMatchObject({ closed: 1 })
    expect(t.sessions[0].status).toBe('auto_closed')
  })

  it('stops reminding people who already confirmed', async () => {
    const t = setup()
    const { session } = await t.service.create(scope, { dormId: D1, closesAt: min(90) })
    for (const id of ['s1', 's2', 's3']) {
      await t.repo.applySelfCheckin({ sessionId: session.id, studentId: id, state: 'present', selfDistanceM: 5 })
    }
    t.sessions[0].last_reminded_at = min(-10)
    await t.service.runCron()
    expect(t.send).not.toHaveBeenCalled()
  })
})

describe("student check-in reaches the student's OWN dekan roll-call", () => {
  function legacyFor(t: ReturnType<typeof setup>) {
    const legacyRepo = {
      studentDormId: async () => D1,
      dormIdForFaculty: async () => D1,
      dorm: async () => ({ id: D1, latitude: 41.3, longitude: 69.2, checkin_radius_m: 1000 }),
      openSessions: async () => [],
      seedRecords: t.repo.seedRecords,
      applySelfCheckin: t.repo.applySelfCheckin,
    }
    return createAttendanceService(legacyRepo as never, t.drepo as never)
  }
  const here = { lat: 41.3001, lng: 69.2001, accuracy: 20 }

  it('records present on the dekan session for the right faculty + dorm', async () => {
    const t = setup()
    const { session } = await t.service.create(scope, { dormId: D1, closesAt: min(60) })
    const res = await legacyFor(t).checkin('s1', 'amit', here)
    expect(res.status).toBe('present')
    expect(t.records.get(session.id)!.get('s1')!.state).toBe('present')
  })

  it("does not touch another faculty's roll-call in the same dorm", async () => {
    const t = setup()
    await t.service.create(scope, { dormId: D1, closesAt: min(60) })
    // x1 studies at iqtisodiyot: AMIT's session must be invisible to them.
    const res = await legacyFor(t).checkin('x1', 'iqtisodiyot', here)
    expect(res).toEqual({ status: 'no_session' })
    expect(t.records.get(t.sessions[0].id)!.has('x1')).toBe(false)
  })

  it('a student who is not a roll-call resident of that dorm + faculty leaves no stray row', async () => {
    const t = setup()
    const { session } = await t.service.create(scope, { dormId: D1, closesAt: min(60) })
    t.students.find((s) => s.id === 's2')!.moved = true
    const res = await legacyFor(t).checkin('s2', 'amit', here)
    expect(res).toEqual({ status: 'no_session' })
    expect(t.records.get(session.id)!.get('s2')!.state).toBe('unmarked')
  })

  it('marks absent when the student is outside the radius, and they can retry', async () => {
    const t = setup()
    const { session } = await t.service.create(scope, { dormId: D1, closesAt: min(60) })
    const far = { lat: 41.4, lng: 69.35, accuracy: 20 }
    expect((await legacyFor(t).checkin('s1', 'amit', far)).status).toBe('outside')
    expect(t.records.get(session.id)!.get('s1')!.state).toBe('absent')
    expect((await legacyFor(t).checkin('s1', 'amit', here)).status).toBe('present')
    expect(t.records.get(session.id)!.get('s1')!.state).toBe('present')
  })
})
