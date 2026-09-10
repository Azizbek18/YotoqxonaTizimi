import { describe, expect, it } from 'vitest'
import {
  CORRIDOR_WIDTH,
  sectionFloorLayout,
  sectionOccupancy,
  sideForRoom,
  sizeForCapacity,
} from './blocked-building-3d'
import { BLOCKED_ROOM_CAPACITIES, type BlockedRoom } from '@/features/dorms/types'

const room = (over: Partial<BlockedRoom> = {}): BlockedRoom => ({
  roomNumber: '1',
  capacity: 6,
  frozen: false,
  gender: null,
  occupants: [],
  ...over,
})

// A full 9-room blocked section, numbered 1..9 with the fixed bed counts.
const fullSection = (): BlockedRoom[] =>
  BLOCKED_ROOM_CAPACITIES.map((cap, i) => room({ roomNumber: String(i + 1), capacity: cap }))

describe('sideForRoom', () => {
  it('puts 1,3,7,9 on the right and 2,4,5,6,8 on the left of the corridor', () => {
    for (const n of ['1', '3', '7', '9']) expect(sideForRoom(n)).toBe('right')
    for (const n of ['2', '4', '5', '6', '8']) expect(sideForRoom(n)).toBe('left')
  })
})

describe('sizeForCapacity', () => {
  it('maps 4-bed rooms small, 6-bed medium, 8-bed large', () => {
    expect(sizeForCapacity(4)).toBe('small')
    expect(sizeForCapacity(6)).toBe('medium')
    expect(sizeForCapacity(8)).toBe('large')
  })
})

describe('sectionFloorLayout', () => {
  const layout = sectionFloorLayout(fullSection())

  it('lays out all 9 rooms once', () => {
    expect(layout.rooms.map((r) => r.roomNumber).sort((a, b) => Number(a) - Number(b)))
      .toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
  })

  it('keeps every room clear of the corridor, left side negative / right positive', () => {
    for (const r of layout.rooms) {
      expect(Math.abs(r.x)).toBeGreaterThan(CORRIDOR_WIDTH / 2)
      expect(Math.sign(r.x)).toBe(r.side === 'left' ? -1 : 1)
    }
  })

  it('carries capacity, frozen and occupied through to the placed room', () => {
    const rooms = [
      room({ roomNumber: '1', capacity: 4, occupants: [{ name: 'A', gender: null, kind: 'user' }] }),
      room({ roomNumber: '2', capacity: 6, frozen: true }),
    ]
    const placed = sectionFloorLayout(rooms).rooms
    expect(placed.find((r) => r.roomNumber === '1')).toMatchObject({ capacity: 4, occupied: 1, frozen: false })
    expect(placed.find((r) => r.roomNumber === '2')).toMatchObject({ capacity: 6, occupied: 0, frozen: true })
  })

  it('sizes the slab to enclose the rooms', () => {
    expect(layout.slabWidth).toBeGreaterThan(CORRIDOR_WIDTH)
    expect(layout.slabDepth).toBeGreaterThan(2)
  })
})

describe('sectionOccupancy', () => {
  it('sums occupants and non-frozen capacity', () => {
    const rooms = [
      room({ capacity: 4, occupants: [{ name: 'A', gender: null, kind: 'user' }] }),
      room({ capacity: 6, occupants: [{ name: 'B', gender: null, kind: 'permit' }, { name: 'C', gender: null, kind: 'user' }] }),
      room({ capacity: 8 }),
    ]
    expect(sectionOccupancy(rooms)).toEqual({ filled: 3, total: 18 })
  })

  it('a frozen room adds its occupants but no capacity', () => {
    const rooms = [room({ capacity: 6, frozen: true, occupants: [{ name: 'X', gender: null, kind: 'user' }] })]
    expect(sectionOccupancy(rooms)).toEqual({ filled: 1, total: 0 })
  })
})
