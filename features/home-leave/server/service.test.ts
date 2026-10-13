import { describe, expect, it, vi } from 'vitest'

vi.mock('./repository', () => ({ createHomeLeaveRepository: () => ({}) }))

const { createHomeLeaveService } = await import('./service')

const NOW = new Date('2026-10-13T08:00:00Z')
const BODY = {
  destinationKind: 'qarindosh', destinationAddress: 'Samarqand, Urgut tumani', contactName: 'Aliyev Vali',
  contactPhone: '+998901234567', startsOn: '2026-10-13', endsOn: '2026-10-16', consent: true,
}
const ROW = {
  id: 'l1', student_id: 's1', destination_kind: 'qarindosh', destination_address: 'x', destination_lat: null, destination_lng: null,
  contact_name: 'A', contact_phone: '+998901234567', reason: null, starts_on: '2026-10-13', ends_on: '2026-10-16', status: 'active',
  consented_at: '', loc_status: 'none', loc_lat: null, loc_lng: null, loc_at: null, call_result: 'none', call_by_name: null, call_at: null,
  decided_by: null, decided_by_name: null, decided_at: null, decision_note: null, returned_at: null, created_at: '',
}

function build(overrides: Record<string, unknown> = {}) {
  const repository = {
    findStudent: vi.fn().mockResolvedValue({ id: 's1', status: 'active', is_off_campus: false, dorm_id: 'd1', full_name: 'Ali' }),
    openForStudent: vi.fn().mockResolvedValue([]),
    hadSuspicious: vi.fn().mockResolvedValue(false),
    insert: vi.fn().mockImplementation(async (_id: string, f: Record<string, unknown>) => ({ ...ROW, ...f })),
    markOpenSessions: vi.fn().mockResolvedValue(undefined),
    releaseOpenSessions: vi.fn().mockResolvedValue(undefined),
    getById: vi.fn().mockResolvedValue({ ...ROW, users: { faculty: 'amit', dorm_id: 'd1' } }),
    update: vi.fn().mockImplementation(async (_id: string, _from: string[], f: Record<string, unknown>) => ({ ...ROW, ...f })),
    patchMeta: vi.fn().mockImplementation(async (_id: string, f: Record<string, unknown>) => ({ ...ROW, ...f })),
    ...overrides,
  }
  return { repository, service: createHomeLeaveService(repository as never) }
}

describe('home leave: create', () => {
  it('activates a short leave at once and marks the open roll-call as home', async () => {
    const { service, repository } = build()
    const out = await service.create('s1', BODY, NOW)
    expect(out.leave.status).toBe('active')
    expect(out.needsReview).toBe(false)
    expect(repository.markOpenSessions).toHaveBeenCalledWith('s1')
  })

  it('sends a long leave to the dekan and does not touch the roll-call yet', async () => {
    const { service, repository } = build()
    const out = await service.create('s1', { ...BODY, endsOn: '2026-10-25' }, NOW)
    expect(out.leave.status).toBe('pending')
    expect(repository.markOpenSessions).not.toHaveBeenCalled()
  })

  it('sends the next leave to the dekan after a suspicious one', async () => {
    const { service } = build({ hadSuspicious: vi.fn().mockResolvedValue(true) })
    expect((await service.create('s1', BODY, NOW)).leave.status).toBe('pending')
  })

  it('refuses KV students, overlapping dates and too many open leaves', async () => {
    await expect(build({ findStudent: vi.fn().mockResolvedValue({ id: 's1', status: 'active', is_off_campus: true, dorm_id: null }) })
      .service.create('s1', BODY, NOW)).rejects.toMatchObject({ status: 403 })
    await expect(build({ openForStudent: vi.fn().mockResolvedValue([{ starts_on: '2026-10-15', ends_on: '2026-10-18' }]) })
      .service.create('s1', BODY, NOW)).rejects.toMatchObject({ status: 409 })
    const three = [
      { starts_on: '2026-12-01', ends_on: '2026-12-02' },
      { starts_on: '2026-12-05', ends_on: '2026-12-06' },
      { starts_on: '2026-12-09', ends_on: '2026-12-10' },
    ]
    await expect(build({ openForStudent: vi.fn().mockResolvedValue(three) })
      .service.create('s1', BODY, NOW)).rejects.toMatchObject({ status: 429 })
  })
})

describe('home leave: finish, location and decisions', () => {
  it('lets the owner end a leave and releases the home mark', async () => {
    const { service, repository } = build()
    await service.finish('s1', 'l1', 'return', NOW)
    expect(repository.releaseOpenSessions).toHaveBeenCalledWith('s1')
    await expect(service.finish('someone-else', 'l1', 'cancel', NOW)).rejects.toMatchObject({ status: 404 })
  })

  it('judges a shared location against the pinned destination, but never requires it', async () => {
    const pinned = { ...ROW, destination_lat: 39.65, destination_lng: 66.96, users: { faculty: 'amit', dorm_id: 'd1' } }
    const { service, repository } = build({ getById: vi.fn().mockResolvedValue(pinned) })
    await service.shareLocation('s1', 'l1', { lat: 39.7, lng: 67.0 }, NOW)
    expect(repository.patchMeta).toHaveBeenLastCalledWith('l1', expect.objectContaining({ loc_status: 'near' }))
    await service.shareLocation('s1', 'l1', { lat: 41.3, lng: 69.2 }, NOW)
    expect(repository.patchMeta).toHaveBeenLastCalledWith('l1', expect.objectContaining({ loc_status: 'far' }))
    const unpinned = build()
    await unpinned.service.shareLocation('s1', 'l1', { lat: 41.3, lng: 69.2 }, NOW)
    expect(unpinned.repository.patchMeta).toHaveBeenLastCalledWith('l1', expect.objectContaining({ loc_status: 'shared', loc_lat: 41.3 }))
  })

  it('records a staff call result only inside the actor scope', async () => {
    const actor = { userId: 't1', role: 'tarbiyachi', dormId: 'd1', faculties: ['amit'], floor: null, gender: null, canWrite: true } as never
    const { service } = build()
    await expect(service.recordCall(actor, 'Tarbiyachi', 'l1', 'ok', NOW)).resolves.toMatchObject({ callResult: 'ok' })
    await expect(service.recordCall(actor, 'T', 'l1', 'weird', NOW)).rejects.toMatchObject({ status: 400 })
    const other = { ...(actor as object), dormId: 'd2' } as never
    await expect(service.recordCall(other, 'T', 'l1', 'ok', NOW)).rejects.toMatchObject({ status: 404 })
  })

  it('dekan approves a pending leave in their faculty only and requires a reason to reject', async () => {
    const pending = { ...ROW, status: 'pending', users: { faculty: 'amit', dorm_id: 'd1' } }
    const { service, repository } = build({ getById: vi.fn().mockResolvedValue(pending) })
    const staff = { id: 'dk1', full_name: 'Dekan' }
    await expect(service.decide('l1', 'iqtisodiyot', staff, { action: 'approve' }, NOW)).rejects.toMatchObject({ status: 403 })
    await expect(service.decide('l1', 'amit', staff, { action: 'reject' }, NOW)).rejects.toMatchObject({ status: 400 })
    const ok = await service.decide('l1', 'amit', staff, { action: 'approve' }, NOW)
    expect(ok.leave.status).toBe('active')
    expect(repository.markOpenSessions).toHaveBeenCalledWith('s1')
  })
})

describe('home leave: overdue', () => {
  const ended = (id: string, studentId: string) => ({ ...ROW, id, student_id: studentId, ends_on: '2026-10-10', users: { full_name: 'Ali', faculty: 'amit', dorm_id: 'd1' } })

  it('closes the leave of a student who is present after it ended and flags one missed in a closed roll-call', async () => {
    const { service, repository } = build({
      listEnded: vi.fn().mockResolvedValue([ended('a', 's1'), ended('b', 's2'), ended('c', 's3')]),
      recordsAfter: vi.fn().mockResolvedValue([
        { student_id: 's1', state: 'present', scheduled_for: '2026-10-11', session_status: 'closed' },
        { student_id: 's2', state: 'unmarked', scheduled_for: '2026-10-11', session_status: 'auto_closed' },
      ]),
    })
    const overdue = await service.findOverdue(undefined, NOW)
    expect(overdue.map((l) => l.id)).toEqual(['b'])
    expect(repository.update).toHaveBeenCalledWith('a', ['active'], expect.objectContaining({ status: 'returned' }))
    expect(repository.update).toHaveBeenCalledTimes(1)
  })

  it('skips the records query when nothing has ended', async () => {
    const recordsAfter = vi.fn()
    const { service } = build({ listEnded: vi.fn().mockResolvedValue([]), recordsAfter })
    expect(await service.findOverdue(undefined, NOW)).toEqual([])
    expect(recordsAfter).not.toHaveBeenCalled()
  })
})

