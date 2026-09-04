import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'
import { createRoomLayoutService } from './service'
import type { RoomLayoutRepository } from './repository'

const FACULTY = 'amit'

function block(roomNumber: string) {
  return { roomNumber, side: 'left', size: 'medium' }
}

function repository(overrides: Partial<RoomLayoutRepository> = {}) {
  return {
    scopeFor: vi.fn(async () => ({ dormId: 'd1', floors: null })),
    listAllRooms: vi.fn(async () => []),
    occupiedRoomNumbers: vi.fn(async () => new Set<string>()),
    applyBuildingLayout: vi.fn(async () => ({ created: 0, removed: 0, renumbered: 0 })),
    insertRooms: vi.fn(async () => {}),
    listFloor: vi.fn(async () => []),
    replaceFloor: vi.fn(async () => {}),
    syncAssignedFloors: vi.fn(async () => {}),
    setFrozen: vi.fn(async () => true),
    setCapacity: vi.fn(async () => true),
    bulkSetCapacity: vi.fn(async () => 0),
    setGender: vi.fn(async () => true),
    bulkSetGender: vi.fn(async () => 0),
    ...overrides,
  } as unknown as RoomLayoutRepository
}

// floor_room_layout row shape listAllRooms returns (position/size added for trim)
function existingRoom(room_number: string, floor_number: number, extra: Record<string, unknown> = {}) {
  return { room_number, floor_number, side: 'left', position: 0, size: 'medium', frozen: false, frozen_reason: null, capacity: null, gender: null, ...extra }
}

describe('room layout service', () => {
  it('moves the residents of a saved floor onto that floor', async () => {
    const repo = repository()
    await createRoomLayoutService(repo).saveFloor(FACULTY, 3, [block('101'), block('102')])

    // syncAssignedFloors stays room-number scoped (physical floor), not faculty scoped
    expect(repo.syncAssignedFloors).toHaveBeenCalledWith('d1', 3, ['101', '102'])
    expect(repo.replaceFloor).toHaveBeenCalledWith(FACULTY, 3, expect.any(Array))
  })

  it('does not sync residents when the layout itself failed to save', async () => {
    const repo = repository({
      replaceFloor: vi.fn(async () => {
        throw new Error('boom')
      }),
    })

    await expect(createRoomLayoutService(repo).saveFloor(FACULTY, 1, [block('101')])).rejects.toThrow()
    expect(repo.syncAssignedFloors).not.toHaveBeenCalled()
  })

  // The layout is already committed at this point, so "saqlanmadi" would be
  // wrong — the message has to tell the admin that re-saving is the fix.
  it('reports a failed resident sync separately from the save', async () => {
    const repo = repository({
      syncAssignedFloors: vi.fn(async () => {
        throw new Error('boom')
      }),
    })

    await expect(createRoomLayoutService(repo).saveFloor(FACULTY, 1, [block('101')])).rejects.toMatchObject({
      status: 500,
    })
  })

  it('rejects a duplicated room number before touching the database', async () => {
    const repo = repository()

    await expect(createRoomLayoutService(repo).saveFloor(FACULTY, 1, [block('101'), block('101')]))
      .rejects.toBeInstanceOf(ApiError)
    expect(repo.replaceFloor).not.toHaveBeenCalled()
  })

  describe('generateFloors', () => {
    it('delegates the full plan to apply_building_layout and returns its counts', async () => {
      const repo = repository({
        applyBuildingLayout: vi.fn(async () => ({ created: 3, removed: 0, renumbered: 0 })),
      } as Partial<RoomLayoutRepository>)

      const result = await createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 3 }], 'sequential')

      expect(result).toEqual({ success: true, created: 3, removed: 0, renumbered: 0 })
      expect(repo.applyBuildingLayout).toHaveBeenCalledWith(FACULTY, 'sequential', [{ floor: 1, rooms: 3 }])
    })

    it('carries floors that have rooms but are missing from the plan at their current count', async () => {
      const repo = repository({
        listAllRooms: vi.fn(async () => [
          existingRoom('1', 1), existingRoom('2', 1),
          existingRoom('31', 2), existingRoom('32', 2), existingRoom('33', 2),
        ]),
        applyBuildingLayout: vi.fn(async () => ({ created: 0, removed: 0, renumbered: 3 })),
      } as Partial<RoomLayoutRepository>)

      await createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 5 }], 'sequential')

      // floor 2 (not in the plan) is appended so the sequential run stays intact
      expect(repo.applyBuildingLayout).toHaveBeenCalledWith(FACULTY, 'sequential', [
        { floor: 1, rooms: 5 },
        { floor: 2, rooms: 3 },
      ])
    })

    it('passes per-floor numbering through', async () => {
      const repo = repository()
      await createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 2, rooms: 4 }], 'per-floor')
      expect(repo.applyBuildingLayout).toHaveBeenCalledWith(FACULTY, 'per-floor', [{ floor: 2, rooms: 4 }])
    })

    it('turns a P0003 from the RPC into a 409 that keeps the room list', async () => {
      const repo = repository({
        applyBuildingLayout: vi.fn(async () => {
          throw Object.assign(new Error("Band xonalarni qayta raqamlab bo'lmadi: 45, 46"), { code: 'P0003' })
        }),
      } as Partial<RoomLayoutRepository>)

      await expect(createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 1 }], 'sequential'))
        .rejects.toMatchObject({ status: 409, message: expect.stringContaining('45, 46') })
    })

    it('turns a P0007 into a 403', async () => {
      const repo = repository({
        applyBuildingLayout: vi.fn(async () => { throw Object.assign(new Error('nope'), { code: 'P0007' }) }),
      } as Partial<RoomLayoutRepository>)
      await expect(createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 1 }], 'sequential'))
        .rejects.toMatchObject({ status: 403 })
    })

    it('is a no-op for an all-zero plan against an empty building', async () => {
      const repo = repository()
      const result = await createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 0 }], 'sequential')
      expect(result).toMatchObject({ created: 0, removed: 0, renumbered: 0 })
      expect(repo.applyBuildingLayout).not.toHaveBeenCalled()
    })

    it('rejects the same floor twice', async () => {
      const repo = repository()
      await expect(
        createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 2 }, { floor: 1, rooms: 3 }], 'sequential'),
      ).rejects.toBeInstanceOf(ApiError)
    })
  })

  it('exposes the whole-building room -> floor map, including frozen + declared gender', async () => {
    const repo = repository({
      listAllRooms: vi.fn(async () => [
        existingRoom('101', 1, { gender: 'female' }),
        existingRoom('201', 2, { frozen: true, frozen_reason: "Ta'mirlash ishlari" }),
      ]),
    } as Partial<RoomLayoutRepository>)

    await expect(createRoomLayoutService(repo).listRoomFloors(FACULTY)).resolves.toEqual([
      { roomNumber: '101', floor: 1, frozen: false, frozenReason: null, capacity: null, gender: 'female' },
      { roomNumber: '201', floor: 2, frozen: true, frozenReason: "Ta'mirlash ishlari", capacity: null, gender: null },
    ])
    expect(repo.listAllRooms).toHaveBeenCalledWith(FACULTY)
  })

  describe('setFrozen', () => {
    it('freezes a room with a reason', async () => {
      const repo = repository()
      const result = await createRoomLayoutService(repo).setFrozen(FACULTY, '101', true, "Ta'mirlash ishlari")

      expect(repo.setFrozen).toHaveBeenCalledWith(FACULTY, '101', true, "Ta'mirlash ishlari")
      expect(result).toEqual({ success: true, roomNumber: '101', frozen: true })
    })

    // Thawing a room shouldn't leave a stale reason from its last freeze
    // sitting around for the next one to accidentally inherit.
    it('drops the reason when unfreezing, even if one was passed', async () => {
      const repo = repository()
      await createRoomLayoutService(repo).setFrozen(FACULTY, '101', false, 'ignored')

      expect(repo.setFrozen).toHaveBeenCalledWith(FACULTY, '101', false, null)
    })

    it('rejects an unknown room', async () => {
      const repo = repository({ setFrozen: vi.fn(async () => false) } as Partial<RoomLayoutRepository>)

      await expect(createRoomLayoutService(repo).setFrozen(FACULTY, '999', true, null))
        .rejects.toMatchObject({ status: 404 })
    })

    it('rejects a missing room number', async () => {
      const repo = repository()
      await expect(createRoomLayoutService(repo).setFrozen(FACULTY, '', true, null))
        .rejects.toBeInstanceOf(ApiError)
      expect(repo.setFrozen).not.toHaveBeenCalled()
    })

    it('rejects a non-boolean frozen value', async () => {
      const repo = repository()
      await expect(createRoomLayoutService(repo).setFrozen(FACULTY, '101', 'yes', null))
        .rejects.toBeInstanceOf(ApiError)
      expect(repo.setFrozen).not.toHaveBeenCalled()
    })
  })

  describe('setGender', () => {
    it('reserves a room for one gender', async () => {
      const repo = repository()
      const result = await createRoomLayoutService(repo).setGender(FACULTY, '101', 'female')

      expect(repo.setGender).toHaveBeenCalledWith(FACULTY, '101', 'female')
      expect(result).toEqual({ success: true, roomNumber: '101', gender: 'female' })
    })

    it("clears the reservation on null / '' and tolerates the Uzbek word", async () => {
      const repo = repository()
      await createRoomLayoutService(repo).setGender(FACULTY, '101', null)
      expect(repo.setGender).toHaveBeenLastCalledWith(FACULTY, '101', null)

      await createRoomLayoutService(repo).setGender(FACULTY, '101', 'Erkak')
      expect(repo.setGender).toHaveBeenLastCalledWith(FACULTY, '101', 'male')
    })

    it('rejects a nonsense gender value', async () => {
      const repo = repository()
      await expect(createRoomLayoutService(repo).setGender(FACULTY, '101', 'banana'))
        .rejects.toBeInstanceOf(ApiError)
      expect(repo.setGender).not.toHaveBeenCalled()
    })

    it('rejects an unknown room', async () => {
      const repo = repository({ setGender: vi.fn(async () => false) } as Partial<RoomLayoutRepository>)
      await expect(createRoomLayoutService(repo).setGender(FACULTY, '999', 'male'))
        .rejects.toMatchObject({ status: 404 })
    })

    it('bulk: de-dupes, caps at 500, reports how many changed', async () => {
      const repo = repository({ bulkSetGender: vi.fn(async () => 3) } as Partial<RoomLayoutRepository>)
      const result = await createRoomLayoutService(repo).bulkSetGender(FACULTY, ['1', '1', '2', '3'], 'male')

      expect(repo.bulkSetGender).toHaveBeenCalledWith(FACULTY, ['1', '2', '3'], 'male')
      expect(result).toEqual({ success: true, changed: 3, gender: 'male' })
    })

    it('bulk: rejects an empty selection', async () => {
      const repo = repository()
      await expect(createRoomLayoutService(repo).bulkSetGender(FACULTY, [], 'male'))
        .rejects.toBeInstanceOf(ApiError)
      expect(repo.bulkSetGender).not.toHaveBeenCalled()
    })
  })
})

// A faculty with a second building (many-to-many, 202609300000 +
// 202609300002 dormId-override RPCs) — every method takes an optional
// trailing dormId; every test above (which never passes one) proves the
// omitted case forwards NOTHING extra to the repository, byte-identical to
// before this parameter existed.
describe('room layout service — a specific building (dormId)', () => {
  const DORM2 = 'd2-uuid'

  it('setFrozen forwards dormId to the repository only when given', async () => {
    const repo = repository()
    await createRoomLayoutService(repo).setFrozen(FACULTY, '101', true, 'sabab', DORM2)
    expect(repo.setFrozen).toHaveBeenCalledWith(FACULTY, '101', true, 'sabab', DORM2)
  })

  it('setCapacity / bulkSetCapacity / setGender / bulkSetGender forward dormId', async () => {
    const repo = repository()
    const service = createRoomLayoutService(repo)

    await service.setCapacity(FACULTY, '101', 3, DORM2)
    expect(repo.setCapacity).toHaveBeenCalledWith(FACULTY, '101', 3, DORM2)

    await service.bulkSetCapacity(FACULTY, ['101', '102'], 2, DORM2)
    expect(repo.bulkSetCapacity).toHaveBeenCalledWith(FACULTY, ['101', '102'], 2, DORM2)

    await service.setGender(FACULTY, '101', 'female', DORM2)
    expect(repo.setGender).toHaveBeenCalledWith(FACULTY, '101', 'female', DORM2)

    await service.bulkSetGender(FACULTY, ['101'], 'male', DORM2)
    expect(repo.bulkSetGender).toHaveBeenCalledWith(FACULTY, ['101'], 'male', DORM2)
  })

  it('getFloor / saveFloor forward dormId to listFloor / replaceFloor', async () => {
    const repo = repository()
    const service = createRoomLayoutService(repo)

    await service.getFloor(FACULTY, 2, DORM2)
    expect(repo.listFloor).toHaveBeenCalledWith(FACULTY, 2, DORM2)

    await service.saveFloor(FACULTY, 2, [block('101')], DORM2)
    expect(repo.replaceFloor).toHaveBeenCalledWith(FACULTY, 2, expect.any(Array), DORM2)
  })

  it('saveFloor resolves the resident-floor sync against the SAME building it just saved, not primary', async () => {
    const repo = repository({
      scopeFor: vi.fn(async (faculty: string, dormId?: string) => ({ dormId: dormId ?? 'd1', floors: null })),
    } as Partial<RoomLayoutRepository>)
    await createRoomLayoutService(repo).saveFloor(FACULTY, 2, [block('101')], DORM2)
    expect(repo.scopeFor).toHaveBeenCalledWith(FACULTY, DORM2)
    expect(repo.syncAssignedFloors).toHaveBeenCalledWith(DORM2, 2, ['101'])
  })

  it('generateFloors forwards dormId to listAllRooms and applyBuildingLayout', async () => {
    const repo = repository()
    await createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 3 }], 'sequential', DORM2)
    expect(repo.listAllRooms).toHaveBeenCalledWith(FACULTY, DORM2)
    expect(repo.applyBuildingLayout).toHaveBeenCalledWith(FACULTY, 'sequential', [{ floor: 1, rooms: 3 }], DORM2)
  })

  it('listRoomFloors forwards dormId to listAllRooms', async () => {
    const repo = repository()
    await createRoomLayoutService(repo).listRoomFloors(FACULTY, DORM2)
    expect(repo.listAllRooms).toHaveBeenCalledWith(FACULTY, DORM2)
  })
})
