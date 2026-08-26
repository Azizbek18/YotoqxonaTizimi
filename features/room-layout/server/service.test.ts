import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'
import { createRoomLayoutService } from './service'
import type { RoomLayoutRepository } from './repository'

function block(roomNumber: string) {
  return { roomNumber, side: 'left', size: 'medium' }
}

function repository(overrides: Partial<RoomLayoutRepository> = {}) {
  return {
    listAllRooms: vi.fn(async () => []),
    insertRooms: vi.fn(async () => {}),
    listFloor: vi.fn(async () => []),
    replaceFloor: vi.fn(async () => {}),
    syncAssignedFloors: vi.fn(async () => {}),
    setFrozen: vi.fn(async () => true),
    ...overrides,
  } as unknown as RoomLayoutRepository
}

describe('room layout service', () => {
  it('moves the residents of a saved floor onto that floor', async () => {
    const repo = repository()
    await createRoomLayoutService(repo).saveFloor(3, [block('101'), block('102')])

    expect(repo.syncAssignedFloors).toHaveBeenCalledWith(3, ['101', '102'])
  })

  it('does not sync residents when the layout itself failed to save', async () => {
    const repo = repository({
      replaceFloor: vi.fn(async () => {
        throw new Error('boom')
      }),
    })

    await expect(createRoomLayoutService(repo).saveFloor(1, [block('101')])).rejects.toThrow()
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

    await expect(createRoomLayoutService(repo).saveFloor(1, [block('101')])).rejects.toMatchObject({
      status: 500,
    })
  })

  it('rejects a duplicated room number before touching the database', async () => {
    const repo = repository()

    await expect(createRoomLayoutService(repo).saveFloor(1, [block('101'), block('101')]))
      .rejects.toBeInstanceOf(ApiError)
    expect(repo.replaceFloor).not.toHaveBeenCalled()
  })

  describe('generateFloors', () => {
    it('creates the planned rooms and splits each floor across both sides', async () => {
      const repo = repository()
      const result = await createRoomLayoutService(repo).generateFloors(
        [{ floor: 1, rooms: 3 }],
        'sequential',
      )

      expect(result).toEqual({ success: true, created: 3 })
      expect(repo.insertRooms).toHaveBeenCalledWith([
        { floor_number: 1, room_number: '1', side: 'left', position: 0, size: 'medium' },
        { floor_number: 1, room_number: '2', side: 'left', position: 1, size: 'medium' },
        { floor_number: 1, room_number: '3', side: 'right', position: 0, size: 'medium' },
      ])
    })

    // The actual use case: a floor already has occupied rooms (numbered
    // outside the plan's control) before the dekan ever opens the
    // generator. Only the still-missing numbers get created; the existing
    // room is never touched, resized, or duplicated.
    it('skips room numbers that already exist and leaves them untouched', async () => {
      const repo = repository({
        listAllRooms: vi.fn(async () => [
          { room_number: '1', floor_number: 1, side: 'left', frozen: false, frozen_reason: null },
        ]),
      } as Partial<RoomLayoutRepository>)

      const result = await createRoomLayoutService(repo).generateFloors([{ floor: 1, rooms: 3 }], 'sequential')

      // Floor 1 ends up with 3 rooms total (1 existing + 2 new); balancing
      // that total across both sides — not just the 2 new rooms in
      // isolation — puts one new room on the left (continuing after the
      // existing one) and one on the right.
      expect(result).toEqual({ success: true, created: 2 })
      expect(repo.insertRooms).toHaveBeenCalledWith([
        { floor_number: 1, room_number: '2', side: 'left', position: 1, size: 'medium' },
        { floor_number: 1, room_number: '3', side: 'right', position: 0, size: 'medium' },
      ])
    })

    it('is a no-op, not an error, when every planned room already exists', async () => {
      const repo = repository({
        listAllRooms: vi.fn(async () => [
          { room_number: '1', floor_number: 1, side: 'left', frozen: false, frozen_reason: null },
        ]),
      } as Partial<RoomLayoutRepository>)

      const result = await createRoomLayoutService(repo).generateFloors([{ floor: 1, rooms: 1 }], 'sequential')

      expect(result).toEqual({ success: true, created: 0 })
      expect(repo.insertRooms).not.toHaveBeenCalled()
      expect(repo.syncAssignedFloors).not.toHaveBeenCalled()
    })

    // A room number can already be taken by a completely different floor
    // (hand-drawn, or left over from an earlier numbering scheme) — it
    // must still be skipped, not inserted a second time under whichever
    // floor the new plan happens to assign that number to.
    it('skips a planned number that already exists on a different floor', async () => {
      const repo = repository({
        listAllRooms: vi.fn(async () => [
          { room_number: '2', floor_number: 9, side: 'left', frozen: false, frozen_reason: null },
        ]),
      } as Partial<RoomLayoutRepository>)

      const result = await createRoomLayoutService(repo).generateFloors([{ floor: 1, rooms: 3 }], 'sequential')

      expect(result.created).toBe(2)
      expect(repo.insertRooms).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ room_number: '1' }),
          expect.objectContaining({ room_number: '3' }),
        ]),
      )
      const inserted = (repo.insertRooms as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(inserted).toHaveLength(2)
    })

    it('gives students already living in those rooms their floor', async () => {
      const repo = repository()
      await createRoomLayoutService(repo).generateFloors(
        [{ floor: 1, rooms: 1 }, { floor: 2, rooms: 1 }],
        'sequential',
      )

      expect(repo.syncAssignedFloors).toHaveBeenCalledWith(1, ['1'])
      expect(repo.syncAssignedFloors).toHaveBeenCalledWith(2, ['2'])
    })

    it('rejects a plan with no rooms at all', async () => {
      const repo = repository()
      await expect(createRoomLayoutService(repo).generateFloors([{ floor: 1, rooms: 0 }], 'sequential'))
        .rejects.toBeInstanceOf(ApiError)
      expect(repo.insertRooms).not.toHaveBeenCalled()
    })

    it('rejects the same floor twice', async () => {
      const repo = repository()
      await expect(
        createRoomLayoutService(repo).generateFloors([{ floor: 1, rooms: 2 }, { floor: 1, rooms: 3 }], 'sequential'),
      ).rejects.toBeInstanceOf(ApiError)
    })
  })

  it('exposes the whole-building room -> floor map, including frozen state', async () => {
    const repo = repository({
      listAllRooms: vi.fn(async () => [
        { room_number: '101', floor_number: 1, side: 'left', frozen: false, frozen_reason: null },
        { room_number: '201', floor_number: 2, side: 'left', frozen: true, frozen_reason: "Ta'mirlash ishlari" },
      ]),
    } as Partial<RoomLayoutRepository>)

    await expect(createRoomLayoutService(repo).listRoomFloors()).resolves.toEqual([
      { roomNumber: '101', floor: 1, frozen: false, frozenReason: null },
      { roomNumber: '201', floor: 2, frozen: true, frozenReason: "Ta'mirlash ishlari" },
    ])
  })

  describe('setFrozen', () => {
    it('freezes a room with a reason', async () => {
      const repo = repository()
      const result = await createRoomLayoutService(repo).setFrozen('101', true, "Ta'mirlash ishlari")

      expect(repo.setFrozen).toHaveBeenCalledWith('101', true, "Ta'mirlash ishlari")
      expect(result).toEqual({ success: true, roomNumber: '101', frozen: true })
    })

    // Thawing a room shouldn't leave a stale reason from its last freeze
    // sitting around for the next one to accidentally inherit.
    it('drops the reason when unfreezing, even if one was passed', async () => {
      const repo = repository()
      await createRoomLayoutService(repo).setFrozen('101', false, 'ignored')

      expect(repo.setFrozen).toHaveBeenCalledWith('101', false, null)
    })

    it('rejects an unknown room', async () => {
      const repo = repository({ setFrozen: vi.fn(async () => false) } as Partial<RoomLayoutRepository>)

      await expect(createRoomLayoutService(repo).setFrozen('999', true, null))
        .rejects.toMatchObject({ status: 404 })
    })

    it('rejects a missing room number', async () => {
      const repo = repository()
      await expect(createRoomLayoutService(repo).setFrozen('', true, null))
        .rejects.toBeInstanceOf(ApiError)
      expect(repo.setFrozen).not.toHaveBeenCalled()
    })

    it('rejects a non-boolean frozen value', async () => {
      const repo = repository()
      await expect(createRoomLayoutService(repo).setFrozen('101', 'yes', null))
        .rejects.toBeInstanceOf(ApiError)
      expect(repo.setFrozen).not.toHaveBeenCalled()
    })
  })
})
