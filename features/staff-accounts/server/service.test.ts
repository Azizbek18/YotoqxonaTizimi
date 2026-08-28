import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStaffAccountService } from './service'
import type { StaffAccountRepository } from './repository'

function createFakeRepository(overrides: Record<string, unknown> = {}): StaffAccountRepository {
  return { listAll: vi.fn(async () => []), ...overrides } as unknown as StaffAccountRepository
}

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
