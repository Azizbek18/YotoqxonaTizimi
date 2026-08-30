import { describe, expect, it } from 'vitest'
import { buildRoomCapacityMap, buildRoomFloorMap, getRoomCapacityBreakdown, resolveFloor } from './floor-map'
import type { RoomFloorStatus } from './types'

const room = (roomNumber: string, floor: number, capacity: number | null): RoomFloorStatus => ({
  roomNumber, floor, capacity, frozen: false, frozenReason: null,
})

describe('resolveFloor', () => {
  const map = buildRoomFloorMap([
    { roomNumber: '101', floor: 1 },
    { roomNumber: '205', floor: 2 },
    // Deliberately contradicts the (room - 1) / 30 guess, which would put
    // room 7 on floor 1: the admin's layout has to win.
    { roomNumber: '7', floor: 3 },
  ])

  it('uses the floor the admin entered, not the room-number guess', () => {
    expect(resolveFloor(map, '7')).toBe(3)
    expect(resolveFloor(map, '205')).toBe(2)
  })

  it('ignores surrounding whitespace in the room number', () => {
    expect(resolveFloor(map, ' 101 ')).toBe(1)
  })

  it('falls back to the room-number guess for rooms missing from the layout', () => {
    expect(resolveFloor(map, '45')).toBe(2)
  })

  it('degrades to the guess while the map is still loading', () => {
    expect(resolveFloor(null, '7')).toBe(1)
  })

  it('returns null without a room number', () => {
    expect(resolveFloor(map, null)).toBeNull()
    expect(resolveFloor(map, '')).toBeNull()
  })
})

describe('buildRoomCapacityMap', () => {
  const rooms = [room('1', 1, null), room('2', 1, 2), room(' 3 ', 1, 3)]
  const capMap = buildRoomCapacityMap(rooms)

  it('maps every room, distinguishing "no override" (null) from "unknown room" (undefined)', () => {
    expect(capMap.get('1')).toBeNull()
    expect(capMap.get('2')).toBe(2)
    expect(capMap.has('99')).toBe(false)
  })

  it('trims the room number key', () => {
    expect(capMap.get('3')).toBe(3)
  })
})

describe('getRoomCapacityBreakdown', () => {
  it('buckets by effective capacity, override first then dorm default', () => {
    const rooms = [
      room('1', 1, null), room('2', 1, null), room('3', 1, null),
      room('4', 1, 2), room('5', 1, 2), room('6', 1, 3),
    ]
    expect(getRoomCapacityBreakdown(rooms, 4)).toEqual([
      { capacity: 4, count: 3 },
      { capacity: 2, count: 2 },
      { capacity: 3, count: 1 },
    ])
  })

  it('drops rooms with no effective capacity while the dorm default is still loading', () => {
    const rooms = [room('1', 1, null), room('2', 1, 2)]
    expect(getRoomCapacityBreakdown(rooms, null)).toEqual([{ capacity: 2, count: 1 }])
  })

  it('sorts equal counts by capacity ascending', () => {
    const rooms = [room('1', 1, 2), room('2', 1, 4)]
    expect(getRoomCapacityBreakdown(rooms, 4)).toEqual([
      { capacity: 2, count: 1 },
      { capacity: 4, count: 1 },
    ])
  })
})
