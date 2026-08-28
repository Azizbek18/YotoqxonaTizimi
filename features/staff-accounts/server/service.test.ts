import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'
import { createStaffAccountService } from './service'
import type { StaffAccountRepository } from './repository'

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Test Tarbiyachi',
    email: 'tarbiyachi@example.com',
    phone: '+998901234567',
    role: 'tarbiyachi',
    password: 'SecurePass123!',
    confirmPassword: 'SecurePass123!',
    ...overrides,
  }
}

function createFakeRepository(overrides: Record<string, unknown> = {}): StaffAccountRepository {
  const base = {
    listAll: vi.fn(async () => []),
    findByEmail: vi.fn(async () => null),
    createAuthUser: vi.fn(async () => ({ data: { user: { id: 'new-user-id', email: 'tarbiyachi@example.com' } }, error: null })),
    insertStaffRow: vi.fn(async () => ({ error: null })),
    deleteAuthUser: vi.fn(async () => ({ data: {}, error: null })),
  }
  return { ...base, ...overrides } as unknown as StaffAccountRepository
}

describe('staff account service: create', () => {
  const creatorId = 'admin-id'

  it('rejects any role other than tarbiyachi (blocks admin self-escalation)', async () => {
    const repository = createFakeRepository()
    const service = createStaffAccountService(repository)

    await expect(service.create(creatorId, 'amit', validInput({ role: 'admin' }))).rejects.toMatchObject({
      status: 400,
    })
    expect(repository.createAuthUser).not.toHaveBeenCalled()
  })

  it('rejects a weak password before creating any auth user', async () => {
    const repository = createFakeRepository()
    const service = createStaffAccountService(repository)

    await expect(service.create(creatorId, 'amit', validInput({ password: 'weak', confirmPassword: 'weak' }))).rejects.toMatchObject({
      status: 400,
    })
    expect(repository.createAuthUser).not.toHaveBeenCalled()
  })

  it('rejects a duplicate email before creating any auth user', async () => {
    const repository = createFakeRepository({
      findByEmail: vi.fn(async () => ({ id: 'existing-id' })),
    })
    const service = createStaffAccountService(repository)

    await expect(service.create(creatorId, 'amit', validInput())).rejects.toMatchObject({ status: 409 })
    expect(repository.createAuthUser).not.toHaveBeenCalled()
  })

  it('propagates an auth-user creation failure without inserting a staff row', async () => {
    const repository = createFakeRepository({
      createAuthUser: vi.fn(async () => ({ data: { user: null }, error: { message: 'GoTrue error' } })),
    })
    const service = createStaffAccountService(repository)

    await expect(service.create(creatorId, 'amit', validInput())).rejects.toMatchObject({ status: 400 })
    expect(repository.insertStaffRow).not.toHaveBeenCalled()
  })

  it('rolls back the auth user when inserting the staff row fails', async () => {
    const repository = createFakeRepository({
      createAuthUser: vi.fn(async () => ({ data: { user: { id: 'orphan-id', email: 'tarbiyachi@example.com' } }, error: null })),
      insertStaffRow: vi.fn(async () => ({ error: { message: 'duplicate key' } })),
    })
    const service = createStaffAccountService(repository)

    await expect(service.create(creatorId, 'amit', validInput())).rejects.toMatchObject({
      status: 500,
      message: "Xodim profilini yaratib bo'lmadi",
    })
    expect(repository.deleteAuthUser).toHaveBeenCalledWith('orphan-id')
  })

  it('creates the staff row scoped to the caller faculty, unscoped by floor/gender', async () => {
    const repository = createFakeRepository()
    const service = createStaffAccountService(repository)

    const result = await service.create(creatorId, 'kimyo', validInput())

    expect(result).toEqual({ success: true })
    expect(repository.insertStaffRow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'new-user-id',
        email: 'tarbiyachi@example.com',
        role: 'tarbiyachi',
        status: 'active',
        faculty: 'kimyo',
        assigned_floor: null,
        assigned_gender: null,
        created_by: creatorId,
      }),
    )
    expect(repository.deleteAuthUser).not.toHaveBeenCalled()
  })

  it('rejects malformed input shapes', async () => {
    const repository = createFakeRepository()
    const service = createStaffAccountService(repository)

    await expect(service.create(creatorId, 'amit', null)).rejects.toBeInstanceOf(ApiError)
    await expect(service.create(creatorId, 'amit', 'not-an-object')).rejects.toBeInstanceOf(ApiError)
    await expect(service.create(creatorId, 'amit', [])).rejects.toBeInstanceOf(ApiError)
  })
})

describe('staff account service: list', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates to the repository, passing the faculty scope', async () => {
    const rows = [{ id: '1' }]
    const listAll = vi.fn(async () => rows)
    const repository = createFakeRepository({ listAll })
    const service = createStaffAccountService(repository)

    await expect(service.list('kimyo')).resolves.toBe(rows)
    expect(listAll).toHaveBeenCalledWith('kimyo')
  })
})
