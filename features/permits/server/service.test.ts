import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'
import type { PermitRequestRow } from '@/types/database.generated'
import type { PermitAdminRepository } from './repository'

const sendPermitApprovedEmail = vi.fn(async () => {})
const sendPermitApprovalCancelledEmail = vi.fn(async () => {})
vi.mock('@/lib/email', () => ({ sendPermitApprovedEmail, sendPermitApprovalCancelledEmail }))

const writeAuditLog = vi.fn(async () => {})
vi.mock('@/lib/audit-log', () => ({ writeAuditLog }))

const notifyPermitTelegram = vi.fn(async () => true)
vi.mock('@/lib/permit-telegram', () => ({ notifyPermitTelegram }))

const { createPermitAdminService } = await import('./service')

function permit(overrides: Partial<PermitRequestRow> = {}): PermitRequestRow {
  return {
    id: 'permit-1',
    faculty: 'IT',
    status: 'approved',
    passport_series: 'AA1234567',
    jshshir: '12345678901234',
    full_name: 'Ali Valiyev',
    email: 'ali@example.com',
    room_number: null,
    application_type: 'yollanma',
    ...overrides,
  } as PermitRequestRow
}

type LinkedUser = { id: string; role: string; status: string; faculty: string | null }

function repository(overrides: Partial<PermitAdminRepository> = {}) {
  return {
    load: vi.fn(async () => ({ permits: [], users: [] })),
    find: vi.fn(async () => permit()),
    update: vi.fn(async () => permit({ status: 'pending' })),
    findLinkedUser: vi.fn(async (): Promise<LinkedUser | null> => null),
    deletePendingStudent: vi.fn(async () => {}),
    cancelApproval: vi.fn(async () => permit({ status: 'pending', room_number: null })),
    ...overrides,
  } as unknown as PermitAdminRepository
}

describe('permit admin service — cancel approval', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reverts an approved permit to pending, frees its room and notifies the applicant', async () => {
    const repo = repository()
    const result = await createPermitAdminService(repo).update('IT', { id: 'permit-1', action: 'cancel' }, 'dekan-1')

    expect(result).toMatchObject({ success: true })
    expect(repo.cancelApproval).toHaveBeenCalledWith('permit-1')
    expect(repo.deletePendingStudent).not.toHaveBeenCalled()
    expect(sendPermitApprovalCancelledEmail).toHaveBeenCalledWith('ali@example.com', 'Ali Valiyev')
    expect(notifyPermitTelegram).toHaveBeenCalledWith(expect.objectContaining({ id: 'permit-1', status: 'pending' }))
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'permit.cancel', actorUserId: 'dekan-1' }))
  })

  it('deletes a still-unverified (pending) account, then cancels', async () => {
    const repo = repository({
      findLinkedUser: vi.fn(async () => ({ id: 'u1', role: 'talaba', status: 'pending', faculty: 'IT' })),
    })

    const result = await createPermitAdminService(repo).update('IT', { id: 'permit-1', action: 'cancel' })

    expect(result).toMatchObject({ success: true })
    expect(repo.deletePendingStudent).toHaveBeenCalledWith('u1')
    expect(repo.cancelApproval).toHaveBeenCalled()
  })

  it('refuses once the applicant has verified their account (active)', async () => {
    const repo = repository({
      findLinkedUser: vi.fn(async () => ({ id: 'u1', role: 'talaba', status: 'active', faculty: 'IT' })),
    })

    await expect(createPermitAdminService(repo).update('IT', { id: 'permit-1', action: 'cancel' }))
      .rejects.toMatchObject({ status: 409 })
    expect(repo.deletePendingStudent).not.toHaveBeenCalled()
    expect(repo.cancelApproval).not.toHaveBeenCalled()
  })

  it('refuses when the linked pending account is in another faculty', async () => {
    const repo = repository({
      findLinkedUser: vi.fn(async () => ({ id: 'u1', role: 'talaba', status: 'pending', faculty: 'Filologiya' })),
    })

    await expect(createPermitAdminService(repo).update('IT', { id: 'permit-1', action: 'cancel' }))
      .rejects.toMatchObject({ status: 409 })
    expect(repo.deletePendingStudent).not.toHaveBeenCalled()
  })

  it('refuses to cancel a permit that is not approved', async () => {
    const repo = repository({ find: vi.fn(async () => permit({ status: 'pending' })) })

    await expect(createPermitAdminService(repo).update('IT', { id: 'permit-1', action: 'cancel' }))
      .rejects.toMatchObject({ status: 409 })
    expect(repo.findLinkedUser).not.toHaveBeenCalled()
  })

  it('refuses to cancel another faculty\'s permit', async () => {
    const repo = repository({ find: vi.fn(async () => permit({ faculty: 'Filologiya' })) })

    await expect(createPermitAdminService(repo).update('IT', { id: 'permit-1', action: 'cancel' }))
      .rejects.toBeInstanceOf(ApiError)
  })

  it('treats a lost race (cancelApproval returns null) as a 409', async () => {
    const repo = repository({ cancelApproval: vi.fn(async () => null) })

    await expect(createPermitAdminService(repo).update('IT', { id: 'permit-1', action: 'cancel' }))
      .rejects.toMatchObject({ status: 409 })
    expect(sendPermitApprovalCancelledEmail).not.toHaveBeenCalled()
  })

  it('still rejects unknown actions', async () => {
    const repo = repository()

    await expect(createPermitAdminService(repo).update('IT', { id: 'permit-1', action: 'delete' }))
      .rejects.toMatchObject({ status: 400 })
  })
})

describe('permit admin service — approve / reject audit + email', () => {
  beforeEach(() => vi.clearAllMocks())

  it('approve sends the standard email for a government yo\'llanma and audits', async () => {
    const repo = repository({ find: vi.fn(async () => permit({ status: 'pending' })) })

    await createPermitAdminService(repo).update('IT', { id: 'permit-1', action: 'approve' }, 'dekan-1')

    expect(sendPermitApprovedEmail).toHaveBeenCalledWith('ali@example.com', 'Ali Valiyev', 'yollanma')
    expect(notifyPermitTelegram).toHaveBeenCalledWith(expect.objectContaining({ id: 'permit-1' }))
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'permit.approve' }))
  })

  it('reject requires a reason and audits', async () => {
    const repo = repository({ find: vi.fn(async () => permit({ status: 'pending' })) })

    await expect(createPermitAdminService(repo).update('IT', { id: 'permit-1', action: 'reject' }))
      .rejects.toMatchObject({ status: 400 })

    await createPermitAdminService(repo).update('IT', { id: 'permit-1', action: 'reject', reason: 'Hujjat sifatsiz' })
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'permit.reject' }))
  })
})

describe('permit admin service — updateGlobal (superadmin step-in)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('acts as the permit\'s own faculty and audits under it', async () => {
    const repo = repository({ find: vi.fn(async () => permit({ status: 'pending', faculty: 'Biologiya' })) })

    await createPermitAdminService(repo).updateGlobal({ id: 'permit-1', action: 'approve' }, 'sa-1')

    expect(sendPermitApprovedEmail).toHaveBeenCalled()
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'permit.approve', details: expect.objectContaining({ faculty: 'Biologiya' }) }),
    )
  })

  it('404s a missing permit', async () => {
    const repo = repository({ find: vi.fn(async () => null) })
    await expect(createPermitAdminService(repo).updateGlobal({ id: 'x', action: 'approve' }))
      .rejects.toMatchObject({ status: 404 })
  })

  it('rejects a malformed body', async () => {
    await expect(createPermitAdminService(repository()).updateGlobal({ action: 'approve' }))
      .rejects.toMatchObject({ status: 400 })
  })
})

describe('permit admin service — overview', () => {
  beforeEach(() => vi.clearAllMocks())

  const capacityDeps = (
    rooms: Array<{ room_number: string; frozen: boolean; capacity: number | null; floor_number?: number; gender?: 'male' | 'female' | null }> = [],
    defaultRoomCapacity = 4,
  ) => ({
    roomLayout: {
      listAllRooms: vi.fn(async () => rooms.map((r) => ({
        ...r,
        floor_number: r.floor_number ?? 1,
        gender: (r.gender ?? null) as 'male' | 'female' | null,
      }))),
    },
    appSettings: { get: vi.fn(async () => ({ defaultRoomCapacity })) },
  })

  it('loads only the dekan\'s own faculty and never redacts (data is already scoped)', async () => {
    const load = vi.fn(async () => ({
      permits: [permit({ id: 'p1', faculty: 'fizika', status: 'approved', room_number: '12' })],
      users: [{
        id: 'u1', role: 'talaba', status: 'active', faculty: 'fizika', full_name: 'Aziz',
        passport_series: 'AB1', jshshir: 'J1', phone_number: '+998', gender: 'male',
        direction: 'astronomiya', course: 2, room_number: '12', dorm_id: null, warning_count: 0, blacklisted: false,
      }],
    }))
    const overview = await createPermitAdminService(repository({ load }), capacityDeps()).overview('fizika')

    expect(load).toHaveBeenCalledWith('fizika')
    expect(overview.faculty).toBe('fizika')
    // full identity is present — no blank/redacted fields
    expect(overview.usersWithRooms[0]).toMatchObject({ id: 'u1', full_name: 'Aziz', faculty: 'fizika', course: 2 })
    expect(overview.approvedPermitsWithRooms).toHaveLength(1)
    expect(overview.dashboard.totalOccupiedBeds).toBe(2)
  })

  // A faculty with a second building (many-to-many, 202609300000) can have
  // two same-numbered rooms in different dorms — a caller grouping
  // usersWithRooms by bare room_number would merge their occupants. This
  // just needs dorm_id to survive the mapping so that caller can key on
  // `${dorm_id}:${room_number}` instead.
  it('carries dorm_id through so callers can disambiguate same-numbered rooms across buildings', async () => {
    const load = vi.fn(async () => ({
      permits: [],
      users: [{
        id: 'u1', role: 'talaba', status: 'active', faculty: 'fizika', full_name: 'Aziz',
        passport_series: 'AB1', jshshir: 'J1', phone_number: '+998', gender: 'male',
        direction: 'astronomiya', course: 2, room_number: '101', dorm_id: 'dorm-b', warning_count: 0, blacklisted: false,
      }],
    }))
    const overview = await createPermitAdminService(repository({ load }), capacityDeps()).overview('fizika')
    expect(overview.usersWithRooms[0].dorm_id).toBe('dorm-b')
  })

  it('bed capacity: frozen rooms give no free places, per-room overrides applied', async () => {
    // room 12 holds 2 (student + permit) with an override cap of 3 -> 1 free.
    // room 20 is default 4, empty -> 4 free. room 30 is frozen -> 0, excluded.
    const load = vi.fn(async () => ({
      permits: [permit({ id: 'p1', faculty: 'fizika', status: 'approved', room_number: '12' })],
      users: [{
        id: 'u1', role: 'talaba', status: 'active', faculty: 'fizika', full_name: 'Aziz',
        passport_series: 'AB1', jshshir: 'J1', phone_number: '+998', gender: 'male',
        direction: 'astronomiya', course: 2, room_number: '12', dorm_id: null, warning_count: 0, blacklisted: false,
      }],
    }))
    const deps = capacityDeps([
      { room_number: '12', frozen: false, capacity: 3 },
      { room_number: '20', frozen: false, capacity: null },
      { room_number: '30', frozen: true, capacity: null },
    ], 4)

    const { dashboard } = await createPermitAdminService(repository({ load }), deps).overview('fizika')

    expect(dashboard.availableBeds).toBe(7)   // 3 + 4, frozen room excluded
    expect(dashboard.freeBeds).toBe(5)        // (3-2) + (4-0)
    expect(dashboard.frozenRoomCount).toBe(1)
  })

  it('does not double-count a permit whose applicant has already registered', async () => {
    // Same person: a `users` row (registered) AND their still-'approved'
    // permit, both pointing at room 5. The permit must not count again.
    const load = vi.fn(async () => ({
      permits: [permit({ id: 'p1', faculty: 'fizika', status: 'approved', room_number: '5', passport_series: 'PP9', jshshir: 'JJ9' })],
      users: [{
        id: 'u1', role: 'talaba', status: 'active', faculty: 'fizika', full_name: 'Aziz',
        passport_series: 'PP9', jshshir: 'JJ9', phone_number: '+998', gender: 'male',
        direction: 'astronomiya', course: 2, room_number: '5', dorm_id: null, warning_count: 0, blacklisted: false,
      }],
    }))
    const deps = capacityDeps([{ room_number: '5', frozen: false, capacity: 4 }], 4)

    const { dashboard, approvedPermitsWithRooms } = await createPermitAdminService(repository({ load }), deps).overview('fizika')

    expect(approvedPermitsWithRooms).toHaveLength(0)
    expect(dashboard.totalOccupiedBeds).toBe(1) // the user, once
    expect(dashboard.freeBeds).toBe(3)          // 4 - 1
  })

  it('builds per-floor course balance: proportional targets + placed counts by floor', async () => {
    const load = vi.fn(async () => ({
      // 3 students to house, all course 1; one already placed on floor 2.
      permits: [
        permit({ id: 'pa', faculty: 'fizika', status: 'approved', course: 1, room_number: '21', passport_series: 'A', jshshir: 'A' }),
        permit({ id: 'pb', faculty: 'fizika', status: 'approved', course: 1, room_number: null, passport_series: 'B', jshshir: 'B' }),
      ],
      users: [{
        id: 'u1', role: 'talaba', status: 'active', faculty: 'fizika', full_name: 'X', course: 1,
        passport_series: 'C', jshshir: 'C', phone_number: '+998', gender: 'male', direction: 'd', room_number: '11', dorm_id: null, warning_count: 0, blacklisted: false,
      }],
    }))
    const deps = capacityDeps([
      { room_number: '11', frozen: false, capacity: 10, floor_number: 1 },
      { room_number: '21', frozen: false, capacity: 30, floor_number: 2 },
    ], 4)

    const { dashboard } = await createPermitAdminService(repository({ load }), deps).overview('fizika')

    expect(dashboard.floorBalance).toBeDefined()
    const fb = dashboard.floorBalance!
    expect(fb.totalToHouse[1]).toBe(3)     // u1 + pa + pb
    expect(fb.totalCapacity).toBe(40)
    const f1 = fb.floors.find((f) => f.floor === 1)!
    const f2 = fb.floors.find((f) => f.floor === 2)!
    expect(f1.byCourse[1]).toBe(1)          // u1 in room 11
    expect(f2.byCourse[1]).toBe(1)          // permit pa in room 21
    expect(f2.targetByCourse[1]).toBe(2)    // 30/40 * 3 -> 2.25 -> round 2
    expect(f1.targetByCourse[1]).toBe(1)    // 10/40 * 3 -> 0.75 -> round 1
  })

  it('rejects a dekan with no faculty', async () => {
    await expect(createPermitAdminService(repository(), capacityDeps()).overview(null)).rejects.toMatchObject({ status: 403 })
  })
})
