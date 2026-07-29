import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'
import type { AppSettings } from '@/features/app-settings/types'
import { createStaffAccountService } from './service'
import type { StaffAccountRepository } from './repository'

const FLOOR_COUNT = 5

vi.mock('@/features/app-settings/server/service', () => ({
  createAppSettingsService: () => ({
    get: async (): Promise<AppSettings> => ({
      monthlyFee: 100000,
      yearlyContractFee: 1200000,
      defaultRoomCapacity: 4,
      floorCount: FLOOR_COUNT,
      tarbiyachiName: '',
      tarbiyachiPhone: '',
      komendantName: '',
      komendantPhone: '',
      doctorName: '',
      doctorPhone: '',
      talabaKengashiRaisiOgilName: '',
      talabaKengashiRaisiOgilPhone: '',
      talabaKengashiRaisiQizName: '',
      talabaKengashiRaisiQizPhone: '',
      securityPhone: '',
      maxUploadSizeMb: 10,
      warningThreshold: 3,
    }),
  }),
}))

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    fullName: 'Test Tarbiyachi',
    email: 'tarbiyachi@example.com',
    phone: '+998901234567',
    role: 'tarbiyachi',
    password: 'SecurePass123!',
    confirmPassword: 'SecurePass123!',
    assignedFloor: 3,
    assignedGender: 'male',
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

    await expect(service.create(creatorId, validInput({ role: 'admin' }))).rejects.toMatchObject({
      status: 400,
    })
    expect(repository.createAuthUser).not.toHaveBeenCalled()
  })

  it.each([0, -1, 1.5, FLOOR_COUNT + 1, 50])('rejects assignedFloor=%s outside the real floorCount', async (floor) => {
    const repository = createFakeRepository()
    const service = createStaffAccountService(repository)

    await expect(service.create(creatorId, validInput({ assignedFloor: floor }))).rejects.toMatchObject({
      status: 400,
    })
    expect(repository.createAuthUser).not.toHaveBeenCalled()
  })

  it.each([1, FLOOR_COUNT])('accepts assignedFloor=%s at the boundary of the real floorCount', async (floor) => {
    const repository = createFakeRepository()
    const service = createStaffAccountService(repository)

    await expect(service.create(creatorId, validInput({ assignedFloor: floor }))).resolves.toEqual({ success: true })
  })

  it('rejects when assignedGender is missing', async () => {
    const repository = createFakeRepository()
    const service = createStaffAccountService(repository)

    await expect(service.create(creatorId, validInput({ assignedGender: undefined }))).rejects.toMatchObject({
      status: 400,
    })
  })

  it('rejects a duplicate email before creating any auth user', async () => {
    const repository = createFakeRepository({
      findByEmail: vi.fn(async () => ({ id: 'existing-id' })),
    })
    const service = createStaffAccountService(repository)

    await expect(service.create(creatorId, validInput())).rejects.toMatchObject({ status: 409 })
    expect(repository.createAuthUser).not.toHaveBeenCalled()
  })

  it('propagates an auth-user creation failure without inserting a staff row', async () => {
    const repository = createFakeRepository({
      createAuthUser: vi.fn(async () => ({ data: { user: null }, error: { message: 'GoTrue error' } })),
    })
    const service = createStaffAccountService(repository)

    await expect(service.create(creatorId, validInput())).rejects.toMatchObject({ status: 400 })
    expect(repository.insertStaffRow).not.toHaveBeenCalled()
  })

  it('rolls back the auth user when inserting the staff row fails', async () => {
    const repository = createFakeRepository({
      createAuthUser: vi.fn(async () => ({ data: { user: { id: 'orphan-id', email: 'tarbiyachi@example.com' } }, error: null })),
      insertStaffRow: vi.fn(async () => ({ error: { message: 'duplicate key' } })),
    })
    const service = createStaffAccountService(repository)

    await expect(service.create(creatorId, validInput())).rejects.toMatchObject({
      status: 500,
      message: "Xodim profilini yaratib bo'lmadi",
    })
    expect(repository.deleteAuthUser).toHaveBeenCalledWith('orphan-id')
  })

  it('creates the staff row with the creator id and submitted fields on success', async () => {
    const repository = createFakeRepository()
    const service = createStaffAccountService(repository)

    const result = await service.create(creatorId, validInput({ assignedFloor: 4 }))

    expect(result).toEqual({ success: true })
    expect(repository.insertStaffRow).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'new-user-id',
        email: 'tarbiyachi@example.com',
        role: 'tarbiyachi',
        status: 'active',
        assigned_floor: 4,
        assigned_gender: 'male',
        created_by: creatorId,
      }),
    )
    expect(repository.deleteAuthUser).not.toHaveBeenCalled()
  })

  it('rejects malformed input shapes', async () => {
    const repository = createFakeRepository()
    const service = createStaffAccountService(repository)

    await expect(service.create(creatorId, null)).rejects.toBeInstanceOf(ApiError)
    await expect(service.create(creatorId, 'not-an-object')).rejects.toBeInstanceOf(ApiError)
    await expect(service.create(creatorId, [])).rejects.toBeInstanceOf(ApiError)
  })
})

describe('staff account service: list', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates to the repository and returns every tarbiyachi row unscoped', async () => {
    const rows = [{ id: '1' }]
    const repository = createFakeRepository({ listAll: vi.fn(async () => rows) })
    const service = createStaffAccountService(repository)

    await expect(service.list()).resolves.toBe(rows)
  })
})
