import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'
import type { PermitRequestRow } from '@/types/database.generated'
import type { PermitAdminRepository } from './repository'

const sendPermitApprovedEmail = vi.fn(async () => {})
const sendPermitApprovalCancelledEmail = vi.fn(async () => {})
vi.mock('@/lib/email', () => ({ sendPermitApprovedEmail, sendPermitApprovalCancelledEmail }))

const writeAuditLog = vi.fn(async () => {})
vi.mock('@/lib/audit-log', () => ({ writeAuditLog }))

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
    rooms: Array<{ room_number: string; frozen: boolean; capacity: number | null }> = [],
    defaultRoomCapacity = 4,
  ) => ({
    roomLayout: { listAllRooms: vi.fn(async () => rooms) },
    appSettings: { get: vi.fn(async () => ({ defaultRoomCapacity })) },
  })

  it('loads only the dekan\'s own faculty and never redacts (data is already scoped)', async () => {
    const load = vi.fn(async () => ({
      permits: [permit({ id: 'p1', faculty: 'fizika', status: 'approved', room_number: '12' })],
      users: [{
        id: 'u1', role: 'talaba', status: 'active', faculty: 'fizika', full_name: 'Aziz',
        passport_series: 'AB1', jshshir: 'J1', phone_number: '+998', gender: 'male',
        direction: 'astronomiya', course: 2, room_number: '12', warning_count: 0, blacklisted: false,
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

  it('bed capacity: frozen rooms give no free places, per-room overrides applied', async () => {
    // room 12 holds 2 (student + permit) with an override cap of 3 -> 1 free.
    // room 20 is default 4, empty -> 4 free. room 30 is frozen -> 0, excluded.
    const load = vi.fn(async () => ({
      permits: [permit({ id: 'p1', faculty: 'fizika', status: 'approved', room_number: '12' })],
      users: [{
        id: 'u1', role: 'talaba', status: 'active', faculty: 'fizika', full_name: 'Aziz',
        passport_series: 'AB1', jshshir: 'J1', phone_number: '+998', gender: 'male',
        direction: 'astronomiya', course: 2, room_number: '12', warning_count: 0, blacklisted: false,
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

  it('rejects a dekan with no faculty', async () => {
    await expect(createPermitAdminService(repository(), capacityDeps()).overview(null)).rejects.toMatchObject({ status: 403 })
  })
})
