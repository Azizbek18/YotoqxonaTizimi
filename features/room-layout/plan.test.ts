import { describe, expect, it } from 'vitest'
import { describeFloorFill, planRoomNumbers } from './plan'

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

describe('describeFloorFill', () => {
  it('summarises each floor as all-new when the building is empty', () => {
    expect(describeFloorFill(twoFloors, 'sequential', [])).toEqual([
      { floor: 1, existing: 0, added: 3, total: 3 },
      { floor: 2, existing: 0, added: 2, total: 2 },
    ])
  })

  it('marks empty floors', () => {
    expect(describeFloorFill([{ floor: 1, rooms: 0 }], 'sequential', [])).toEqual([
      { floor: 1, existing: 0, added: 0, total: 0 },
    ])
  })

  // The actual scenario this exists for: a floor already has occupied rooms
  // (e.g. '1' on floor 1) before the dekan ever opens the generator — only
  // the numbers still missing from the planned range should count as new.
  it('only counts rooms that do not already exist as added', () => {
    const existing = [{ roomNumber: '1', floor: 1 }, { roomNumber: '3', floor: 1 }]
    expect(describeFloorFill(twoFloors, 'sequential', existing)).toEqual([
      { floor: 1, existing: 2, added: 1, total: 3 },
      { floor: 2, existing: 0, added: 2, total: 2 },
    ])
  })

  // A room can already exist under a *different* floor than the plan would
  // put it on (e.g. drawn by hand, or left over from an earlier scheme) —
  // it must still count as already-taken, not get created a second time
  // under the floor the plan happens to assign it to.
  it('treats a room number as taken even if it currently sits on a different floor', () => {
    const existing = [{ roomNumber: '4', floor: 5 }]
    expect(describeFloorFill(twoFloors, 'sequential', existing)).toEqual([
      { floor: 1, existing: 0, added: 3, total: 3 },
      { floor: 2, existing: 0, added: 1, total: 1 },
    ])
  })
})
