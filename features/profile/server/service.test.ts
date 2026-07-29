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
