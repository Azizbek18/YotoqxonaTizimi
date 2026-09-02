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
    floor, existing: 0, added: 0, removed: 0, keptOccupied: 0, total: 0, ...over,
  })

  it('summarises each floor as all-new when the building is empty', () => {
    expect(describeFloorFill(twoFloors, 'sequential', [])).toEqual([
      summary(1, { added: 3, total: 3 }),
      summary(2, { added: 2, total: 2 }),
    ])
  })

  it('marks empty floors', () => {
    expect(describeFloorFill([{ floor: 1, rooms: 0 }], 'sequential', [])).toEqual([summary(1)])
  })

  it('only counts rooms that do not already exist as added', () => {
    const existing = [{ roomNumber: '1', floor: 1 }, { roomNumber: '3', floor: 1 }]
    expect(describeFloorFill(twoFloors, 'sequential', existing)).toEqual([
      summary(1, { existing: 2, added: 1, total: 3 }),
      summary(2, { added: 2, total: 2 }),
    ])
  })

  it('treats a room number as taken even if it currently sits on a different floor', () => {
    const existing = [{ roomNumber: '4', floor: 5 }]
    expect(describeFloorFill(twoFloors, 'sequential', existing)).toEqual([
      summary(1, { added: 3, total: 3 }),
      summary(2, { added: 1, total: 1 }),
    ])
  })

  it('marks the excess empty rooms for removal when a floor is over target', () => {
    const existing = ['1', '2', '3', '4', '5'].map((roomNumber) => ({ roomNumber, floor: 1 }))
    expect(describeFloorFill([{ floor: 1, rooms: 3 }], 'sequential', existing)).toEqual([
      summary(1, { existing: 5, removed: 2, total: 3 }),
    ])
  })

  it('never removes an occupied room, even when the floor stays over target', () => {
    const existing = ['1', '2', '3', '4', '5'].map((roomNumber) => ({ roomNumber, floor: 1 }))
    const occupied = new Set(['3', '4', '5'])
    // target 1, but only 1 & 2 are empty → 2 removed, 3/4/5 stay → floor lands at 3
    expect(describeFloorFill([{ floor: 1, rooms: 1 }], 'sequential', existing, occupied)).toEqual([
      summary(1, { existing: 5, removed: 2, keptOccupied: 2, total: 3 }),
    ])
  })
})
