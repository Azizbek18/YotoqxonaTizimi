import { describe, expect, it, vi } from 'vitest'
import { createAppSettingsService } from './service'
import type { AppSettingsRepository } from './repository'
import type { AppSettings } from '../types'

const SETTINGS: AppSettings = {
  monthlyFee: 300000,
  yearlyContractFee: 3000000,
  defaultRoomCapacity: 4,
  floorCount: 5,
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
  maxUploadSizeMb: 5,
  warningThreshold: 2,
  ttjName: '',
}

function fakeRepository(overrides: Partial<AppSettingsRepository> = {}) {
  return {
    get: vi.fn(async () => SETTINGS),
    update: vi.fn(async () => SETTINGS),
    listFacultyFees: vi.fn(async () => []),
    ...overrides,
  } as unknown as AppSettingsRepository
}

describe('createAppSettingsService', () => {
  it('threads the faculty through get()', async () => {
    const repository = fakeRepository()
    await createAppSettingsService(repository).get('fizika')
    expect(repository.get).toHaveBeenCalledWith('fizika')
  })

  it('threads the faculty through update() and its fee-consistency read', async () => {
    const repository = fakeRepository()
    await createAppSettingsService(repository).update({ monthlyFee: 400000, yearlyContractFee: 4000000 }, 'fizika')
    expect(repository.get).toHaveBeenCalledWith('fizika')
    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({ monthly_fee: 400000, yearly_contract_fee: 4000000 }),
      'fizika',
    )
  })

  it('still rejects a yearly fee that is not a whole multiple of the monthly fee', async () => {
    await expect(
      createAppSettingsService(fakeRepository()).update({ monthlyFee: 300000, yearlyContractFee: 3100000 }, 'amit'),
    ).rejects.toThrow(/karralisi/)
  })

  it('passes faculty=undefined straight through (repository picks the primary)', async () => {
    const repository = fakeRepository()
    await createAppSettingsService(repository).get()
    expect(repository.get).toHaveBeenCalledWith(undefined)
  })

  // A faculty can hold several buildings (202609300000) — dormId names
  // which one. Omitted must keep the exact prior call shape (no stray
  // explicit `undefined`), so existing assertions above stay valid.
  it('threads an explicit dormId through get() as a 3rd arg', async () => {
    const repository = fakeRepository()
    await createAppSettingsService(repository).get('fizika', 'dorm-2')
    expect(repository.get).toHaveBeenCalledWith('fizika', 'dorm-2')
  })

  it('threads an explicit dormId through update() as a 3rd arg', async () => {
    const repository = fakeRepository()
    await createAppSettingsService(repository).update({ floorCount: 6 }, 'fizika', 'dorm-2')
    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({ floor_count: 6 }),
      'fizika',
      'dorm-2',
    )
  })

  it('exposes the cross-faculty fee list', async () => {
    const rows = [{ faculty: 'amit', facultyLabel: 'AMIT', monthlyFee: 300000, yearlyContractFee: 3000000, configured: true }]
    const repository = fakeRepository({ listFacultyFees: vi.fn(async () => rows) })
    await expect(createAppSettingsService(repository).listFacultyFees()).resolves.toEqual(rows)
  })
})
