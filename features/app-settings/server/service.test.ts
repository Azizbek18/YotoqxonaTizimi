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
})
