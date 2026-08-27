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
