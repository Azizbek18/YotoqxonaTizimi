import { describe, expect, it, vi } from 'vitest'
import { createProfileService } from './service'
import type { ProfileRepository } from './repository'

function repositoryFor(roomNumber: string, assignedFloor: number | null): ProfileRepository {
  return {
    findStudent: vi.fn(async () => ({
      id: 'student-id',
      role: 'talaba',
      status: 'active',
      room_number: roomNumber,
      assigned_floor: assignedFloor,
      gender: 'male',
    })),
    listRoommates: vi.fn(async () => []),
    findFloorCaptain: vi.fn(async () => null),
    updateStudent: vi.fn(async () => null),
  } as unknown as ProfileRepository
}

describe('profile self-service update', () => {
  it('accepts a group change', async () => {
    const repository = repositoryFor('31', null)
    ;(repository.updateStudent as ReturnType<typeof vi.fn>).mockResolvedValue({ group: '412' })

    const result = await createProfileService(repository).update('student-id', { group: '412' })

    expect(repository.updateStudent).toHaveBeenCalledWith('student-id', { group: '412' })
    expect(result.data).toEqual({ group: '412' })
  })

  // Self-service edit is deliberately narrow to just the group code — name,
  // phone, faculty and room are staff-verified or set by room assignment,
  // never something a student edits from their own profile. A stray/legacy
  // field on the request body (e.g. from an older client) must be silently
  // dropped, not applied.
  it('ignores any field other than group, even if present on the input', async () => {
    const repository = repositoryFor('31', null)
    ;(repository.updateStudent as ReturnType<typeof vi.fn>).mockResolvedValue({ group: '412' })

    await createProfileService(repository).update(
      'student-id',
      { group: '412', full_name: 'Hack Ername', phone: '+998900000000' } as never,
    )

    expect(repository.updateStudent).toHaveBeenCalledWith('student-id', { group: '412' })
  })

  it('rejects an update with nothing to apply', async () => {
    const repository = repositoryFor('31', null)

    await expect(createProfileService(repository).update('student-id', {}))
      .rejects.toThrow('Yangilash uchun ruxsat etilgan ma’lumot topilmadi')
    expect(repository.updateStudent).not.toHaveBeenCalled()
  })
})

describe('profile floor captain lookup', () => {
  it('uses the canonical 30-rooms-per-floor fallback for legacy rows', async () => {
    const repository = repositoryFor('31', null)

    await createProfileService(repository).getProfile('student-id')

    expect(repository.findFloorCaptain).toHaveBeenCalledWith(2, 'male', expect.objectContaining({ id: 'student-id' }))
  })

  it('prefers the persisted assigned floor when it exists', async () => {
    const repository = repositoryFor('31', 5)

    await createProfileService(repository).getProfile('student-id')

    expect(repository.findFloorCaptain).toHaveBeenCalledWith(5, 'male', expect.objectContaining({ id: 'student-id' }))
  })
})

describe('off-campus residence address', () => {
  function kvRepository(isOffCampus: boolean) {
    const repository = repositoryFor('', null)
    ;(repository.findStudent as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'student-id', is_off_campus: isOffCampus })
    ;(repository.updateStudent as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'student-id' })
    return repository
  }

  it('saves address and map coordinates for a KV student', async () => {
    const repository = kvRepository(true)
    await createProfileService(repository).update('student-id', {
      residenceAddress: ' Toshkent, Chilonzor 7 ', residenceLat: 41.3, residenceLng: 69.2,
    })
    expect(repository.updateStudent).toHaveBeenCalledWith('student-id', {
      residence_address: 'Toshkent, Chilonzor 7', residence_lat: 41.3, residence_lng: 69.2,
    })
  })

  it('stores null coordinates for a hand-typed address', async () => {
    const repository = kvRepository(true)
    await createProfileService(repository).update('student-id', { residenceAddress: 'Yunusobod 4-mavze' })
    expect(repository.updateStudent).toHaveBeenCalledWith('student-id', {
      residence_address: 'Yunusobod 4-mavze', residence_lat: null, residence_lng: null,
    })
  })

  it('refuses a dorm student and a too-short address', async () => {
    await expect(createProfileService(kvRepository(false)).update('student-id', { residenceAddress: 'Toshkent shahri' }))
      .rejects.toMatchObject({ status: 403 })
    await expect(createProfileService(kvRepository(true)).update('student-id', { residenceAddress: 'ab' }))
      .rejects.toMatchObject({ status: 400 })
  })
})

describe('off-campus citizenship edit', () => {
  function kv(isOffCampus: boolean) {
    const repository = repositoryFor('', null)
    ;(repository.findStudent as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'student-id', is_off_campus: isOffCampus })
    ;(repository.updateStudent as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'student-id' })
    return repository
  }

  it('sets a country for a foreign KV student and clears it for an Uzbek one', async () => {
    const repository = kv(true)
    await createProfileService(repository).update('student-id', { country: ' Turkmaniston ' })
    expect(repository.updateStudent).toHaveBeenLastCalledWith('student-id', { country: 'Turkmaniston' })
    await createProfileService(repository).update('student-id', { country: null })
    expect(repository.updateStudent).toHaveBeenLastCalledWith('student-id', { country: null })
  })

  it('refuses a dorm student and a too-short country', async () => {
    await expect(createProfileService(kv(false)).update('student-id', { country: 'Turkmaniston' }))
      .rejects.toMatchObject({ status: 403 })
    await expect(createProfileService(kv(true)).update('student-id', { country: 'ab' }))
      .rejects.toMatchObject({ status: 400 })
  })
})
