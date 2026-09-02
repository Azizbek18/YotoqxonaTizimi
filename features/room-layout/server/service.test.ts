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
    insertRooms: vi.fn(async () => {}),
    listFloor: vi.fn(async () => []),
    replaceFloor: vi.fn(async () => {}),
    syncAssignedFloors: vi.fn(async () => {}),
    setFrozen: vi.fn(async () => true),
    ...overrides,
  } as unknown as RoomLayoutRepository
}

// floor_room_layout row shape listAllRooms returns (position/size added for trim)
function existingRoom(room_number: string, floor_number: number, extra: Record<string, unknown> = {}) {
  return { room_number, floor_number, side: 'left', position: 0, size: 'medium', frozen: false, frozen_reason: null, capacity: null, ...extra }
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
    it('creates the planned rooms and splits each floor across both sides', async () => {
      const repo = repository()
      const result = await createRoomLayoutService(repo).generateFloors(
        FACULTY,
        [{ floor: 1, rooms: 3 }],
        'sequential',
      )

      expect(result).toEqual({ success: true, created: 3, removed: 0, keptOccupied: 0 })
      expect(repo.insertRooms).toHaveBeenCalledWith(FACULTY, [
        { floor_number: 1, room_number: '1', side: 'left', position: 0, size: 'medium' },
        { floor_number: 1, room_number: '2', side: 'left', position: 1, size: 'medium' },
        { floor_number: 1, room_number: '3', side: 'right', position: 0, size: 'medium' },
      ])
    })

    it('skips room numbers that already exist and leaves them untouched', async () => {
      const repo = repository({
        listAllRooms: vi.fn(async () => [existingRoom('1', 1)]),
      } as Partial<RoomLayoutRepository>)

      const result = await createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 3 }], 'sequential')

      expect(result).toMatchObject({ success: true, created: 2, removed: 0 })
      expect(repo.insertRooms).toHaveBeenCalledWith(FACULTY, [
        { floor_number: 1, room_number: '2', side: 'left', position: 1, size: 'medium' },
        { floor_number: 1, room_number: '3', side: 'right', position: 0, size: 'medium' },
      ])
      expect(repo.replaceFloor).not.toHaveBeenCalled()
    })

    it('is a no-op, not an error, when the floor already matches the target', async () => {
      const repo = repository({
        listAllRooms: vi.fn(async () => [existingRoom('1', 1)]),
      } as Partial<RoomLayoutRepository>)

      const result = await createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 1 }], 'sequential')

      expect(result).toMatchObject({ created: 0, removed: 0 })
      expect(repo.insertRooms).not.toHaveBeenCalled()
      expect(repo.replaceFloor).not.toHaveBeenCalled()
      expect(repo.syncAssignedFloors).not.toHaveBeenCalled()
    })

    it('deletes the highest-numbered empty rooms when a floor is over target', async () => {
      const repo = repository({
        listAllRooms: vi.fn(async () =>
          ['1', '2', '3', '4', '5'].map((n) => existingRoom(n, 1, { side: Number(n) % 2 ? 'left' : 'right' })),
        ),
      } as Partial<RoomLayoutRepository>)

      const result = await createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 3 }], 'sequential')

      expect(result).toEqual({ success: true, created: 0, removed: 2, keptOccupied: 0 })
      // replace_floor_room_layout gets the KEPT rooms (1,2,3) — 4 and 5 dropped
      const keptRows = (repo.replaceFloor as ReturnType<typeof vi.fn>).mock.calls[0][2]
      expect(keptRows.map((r: { roomNumber: string }) => r.roomNumber)).toEqual(['1', '2', '3'])
      expect(repo.insertRooms).not.toHaveBeenCalled()
    })

    it('never deletes an occupied room, and reports how many stayed', async () => {
      const repo = repository({
        listAllRooms: vi.fn(async () => ['1', '2', '3', '4', '5'].map((n) => existingRoom(n, 1))),
        occupiedRoomNumbers: vi.fn(async () => new Set(['4', '5'])),
      } as Partial<RoomLayoutRepository>)

      const result = await createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 1 }], 'sequential')

      // only 1,2,3 are empty -> 3 removed, 4 & 5 stay (keptOccupied reflects the gap to target)
      expect(result).toEqual({ success: true, created: 0, removed: 3, keptOccupied: 1 })
      const keptRows = (repo.replaceFloor as ReturnType<typeof vi.fn>).mock.calls[0][2]
      expect(keptRows.map((r: { roomNumber: string }) => r.roomNumber)).toEqual(['4', '5'])
    })

    it('surfaces a P0003 from the RPC as a friendly conflict', async () => {
      const repo = repository({
        listAllRooms: vi.fn(async () => ['1', '2', '3'].map((n) => existingRoom(n, 1))),
        replaceFloor: vi.fn(async () => { throw Object.assign(new Error('occupied'), { code: 'P0003' }) }),
      } as Partial<RoomLayoutRepository>)

      await expect(createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 1 }], 'sequential'))
        .rejects.toMatchObject({ status: 409 })
    })

    it('skips a planned number that already exists on a different floor', async () => {
      const repo = repository({
        listAllRooms: vi.fn(async () => [existingRoom('2', 9)]),
      } as Partial<RoomLayoutRepository>)

      const result = await createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 3 }], 'sequential')

      expect(result.created).toBe(2)
      const inserted = (repo.insertRooms as ReturnType<typeof vi.fn>).mock.calls[0][1]
      expect(inserted).toHaveLength(2)
      expect(inserted.map((r: { room_number: string }) => r.room_number)).toEqual(['1', '3'])
    })

    it('gives students already living in those rooms their floor', async () => {
      const repo = repository()
      await createRoomLayoutService(repo).generateFloors(
        FACULTY,
        [{ floor: 1, rooms: 1 }, { floor: 2, rooms: 1 }],
        'sequential',
      )

      expect(repo.syncAssignedFloors).toHaveBeenCalledWith('d1', 1, ['1'])
      expect(repo.syncAssignedFloors).toHaveBeenCalledWith('d1', 2, ['2'])
    })

    it('is a no-op for an all-zero plan against an empty building', async () => {
      const repo = repository()
      const result = await createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 0 }], 'sequential')
      expect(result).toMatchObject({ created: 0, removed: 0 })
      expect(repo.insertRooms).not.toHaveBeenCalled()
    })

    it('rejects the same floor twice', async () => {
      const repo = repository()
      await expect(
        createRoomLayoutService(repo).generateFloors(FACULTY, [{ floor: 1, rooms: 2 }, { floor: 1, rooms: 3 }], 'sequential'),
      ).rejects.toBeInstanceOf(ApiError)
    })
  })

  it('exposes the whole-building room -> floor map, including frozen state', async () => {
    const repo = repository({
      listAllRooms: vi.fn(async () => [
        existingRoom('101', 1),
        existingRoom('201', 2, { frozen: true, frozen_reason: "Ta'mirlash ishlari" }),
      ]),
    } as Partial<RoomLayoutRepository>)

    await expect(createRoomLayoutService(repo).listRoomFloors(FACULTY)).resolves.toEqual([
      { roomNumber: '101', floor: 1, frozen: false, frozenReason: null, capacity: null },
      { roomNumber: '201', floor: 2, frozen: true, frozenReason: "Ta'mirlash ishlari", capacity: null },
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
})
