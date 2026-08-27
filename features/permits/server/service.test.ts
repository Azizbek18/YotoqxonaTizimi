import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'
import type { PermitRequestRow } from '@/types/database.generated'
import type { PermitAdminRepository } from './repository'

const sendPermitApprovedEmail = vi.fn(async () => {})
vi.mock('@/lib/email', () => ({ sendPermitApprovedEmail }))

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
    ...overrides,
  } as PermitRequestRow
}

function repository(overrides: Partial<PermitAdminRepository> = {}) {
  return {
    load: vi.fn(async () => ({ permits: [], users: [] })),
    find: vi.fn(async () => permit()),
    update: vi.fn(async () => permit({ status: 'pending' })),
    findLinkedUser: vi.fn(async () => null),
    cancelApproval: vi.fn(async () => permit({ status: 'pending', room_number: null })),
    ...overrides,
  } as unknown as PermitAdminRepository
}

describe('permit admin service — cancel approval', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reverts an approved permit to pending and frees its room', async () => {
    const repo = repository()
    const result = await createPermitAdminService(repo).update('IT', { id: 'permit-1', action: 'cancel' })

    expect(result).toMatchObject({ success: true })
    expect(repo.cancelApproval).toHaveBeenCalledWith('permit-1')
    expect(sendPermitApprovedEmail).not.toHaveBeenCalled()
  })

  it('refuses once the applicant has a talaba account', async () => {
    const repo = repository({ findLinkedUser: vi.fn(async () => ({ id: 'u1', role: 'talaba', status: 'pending' })) })

    await expect(createPermitAdminService(repo).update('IT', { id: 'permit-1', action: 'cancel' }))
      .rejects.toMatchObject({ status: 409 })
    expect(repo.cancelApproval).not.toHaveBeenCalled()
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
  })

  it('still rejects unknown actions', async () => {
    const repo = repository()

    await expect(createPermitAdminService(repo).update('IT', { id: 'permit-1', action: 'delete' }))
      .rejects.toMatchObject({ status: 400 })
  })
})
