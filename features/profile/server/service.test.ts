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

    expect(repository.findFloorCaptain).toHaveBeenCalledWith(2, 'male')
  })

  it('prefers the persisted assigned floor when it exists', async () => {
    const repository = repositoryFor('31', 5)

    await createProfileService(repository).getProfile('student-id')

    expect(repository.findFloorCaptain).toHaveBeenCalledWith(5, 'male')
  })
})
