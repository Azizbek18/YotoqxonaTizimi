import { describe, expect, it } from 'vitest'
import { compareRoomNumbers, describeFloorFill, planRoomNumbers } from './plan'

const twoFloors = [
  { floor: 1, rooms: 3 },
  { floor: 2, rooms: 2 },
]

describe('planRoomNumbers', () => {
  it('numbers rooms continuously across floors by default', () => {
    expect(planRoomNumbers(twoFloors, 'sequential')).toEqual([
      { roomNumber: '1', floor: 1 },
      { roomNumber: '2', floor: 1 },
      { roomNumber: '3', floor: 1 },
      { roomNumber: '4', floor: 2 },
      { roomNumber: '5', floor: 2 },
    ])
  })

  it('numbers rooms per floor when asked', () => {
    expect(planRoomNumbers(twoFloors, 'per-floor').map((room) => room.roomNumber)).toEqual([
      '101',
      '102',
      '103',
      '201',
      '202',
    ])
  })

  it('keeps floors in order even when given out of order', () => {
    const rooms = planRoomNumbers([{ floor: 2, rooms: 1 }, { floor: 1, rooms: 1 }], 'sequential')
    expect(rooms).toEqual([
      { roomNumber: '1', floor: 1 },
      { roomNumber: '2', floor: 2 },
    ])
  })

  it('skips floors with no rooms without shifting the numbering', () => {
    const rooms = planRoomNumbers([{ floor: 1, rooms: 2 }, { floor: 2, rooms: 0 }, { floor: 3, rooms: 1 }], 'sequential')
    expect(rooms.map((room) => `${room.floor}:${room.roomNumber}`)).toEqual(['1:1', '1:2', '3:3'])
  })
})

describe('compareRoomNumbers', () => {
  it('orders numeric room numbers by value, not as strings', () => {
    expect(['1', '10', '2', '11', '20', '3'].sort(compareRoomNumbers)).toEqual(
      ['1', '2', '3', '10', '11', '20'],
    )
  })

  it('puts numeric rooms before non-numeric ones', () => {
    expect(['12', 'A1', '2', 'Blok-3'].sort(compareRoomNumbers)).toEqual(['2', '12', 'A1', 'Blok-3'])
  })
})

describe('describeFloorFill', () => {
  const summary = (floor: number, over: Partial<ReturnType<typeof describeFloorFill>[number]> = {}) => ({
    floor, existing: 0, target: 0, added: 0, removed: 0, renumbered: 0,
    fromRange: null, toRange: null, conflicts: [], ...over,
  })
  const rooms = (nums: number[], floor: number) => nums.map((n) => ({ roomNumber: String(n), floor }))

  it('summarises each floor as all-new when the building is empty', () => {
    expect(describeFloorFill(twoFloors, 'sequential', [])).toEqual([
      summary(1, { target: 3, added: 3, toRange: [1, 3] }),
      summary(2, { target: 2, added: 2, toRange: [4, 5] }),
    ])
  })

  it('per-floor numbering starts each floor at N01', () => {
    expect(describeFloorFill(twoFloors, 'per-floor', []).map((f) => f.toRange)).toEqual([[101, 103], [201, 202]])
  })

  it('marks empty floors', () => {
    expect(describeFloorFill([{ floor: 1, rooms: 0 }], 'sequential', [])).toEqual([summary(1)])
  })

  // The scenario the user hit: floor 1 shrank to 16, so floor 2 must be
  // renumbered from 31-60 to 17-55 (not "no change").
  it('renumbers a later floor when an earlier one shrinks, and adds the shortfall', () => {
    const existing = [...rooms(range(1, 16), 1), ...rooms(range(31, 60), 2)]
    const [f1, f2] = describeFloorFill([{ floor: 1, rooms: 16 }, { floor: 2, rooms: 39 }], 'sequential', existing)
    expect(f1).toMatchObject({ target: 16, added: 0, removed: 0, renumbered: 0, toRange: [1, 16] })
    expect(f2).toMatchObject({ target: 39, added: 9, removed: 0, renumbered: 30, fromRange: [31, 60], toRange: [17, 55] })
  })

  it('drops the excess empty rooms when a floor is over target', () => {
    const existing = rooms(range(1, 5), 1)
    expect(describeFloorFill([{ floor: 1, rooms: 3 }], 'sequential', existing)).toEqual([
      summary(1, { existing: 5, target: 3, removed: 2, renumbered: 0, fromRange: [1, 5], toRange: [1, 3] }),
    ])
  })

  it('pins an occupied room in range and never renumbers it', () => {
    const existing = rooms(range(1, 5), 1)
    const occ = new Set(['3'])
    const [f] = describeFloorFill([{ floor: 1, rooms: 4 }], 'sequential', existing, occ)
    // #3 pinned; empty 1,2,4,5 -> targets 1,2,4 (one dropped: #5)
    expect(f).toMatchObject({ target: 4, removed: 1, renumbered: 0, conflicts: [] })
  })

  it('flags an occupied room that falls outside the new range as a conflict', () => {
    const existing = rooms(range(1, 5), 1)
    const occ = new Set(['5'])
    const [f] = describeFloorFill([{ floor: 1, rooms: 3 }], 'sequential', existing, occ)
    expect(f.conflicts).toEqual(['5'])
  })
})

function range(lo: number, hi: number) {
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
}
