import { describe, expect, it } from 'vitest'
import {
  sectionOccupancy,
  sectionPlacement,
  sectionRoomLayout,
  BLOCK_GAP,
  CORRIDOR_W,
} from './blocked-building-3d'
import type { BlockedRoom } from '@/features/dorms/types'

const room = (over: Partial<BlockedRoom> = {}): BlockedRoom => ({
  roomNumber: '1',
  capacity: 6,
  frozen: false,
  gender: null,
  occupants: [],
  ...over,
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

describe('sectionPlacement', () => {
  it('puts A left of centre and B right, one BLOCK_GAP apart', () => {
    const a = sectionPlacement('A', 1, 2, 12)
    const b = sectionPlacement('B', 1, 2, 12)
    expect(a.x).toBeLessThan(0)
    expect(b.x).toBeGreaterThan(0)
    expect(b.x - a.x).toBeCloseTo(BLOCK_GAP)
  })

  it('stacks floors bottom-to-top, symmetric about the middle', () => {
    const lo = sectionPlacement('A', 1, 2, 12).y
    const mid = sectionPlacement('A', 6, 2, 12).y
    const hi = sectionPlacement('A', 12, 2, 12).y
    expect(lo).toBeLessThan(mid)
    expect(mid).toBeLessThan(hi)
    expect(lo).toBeCloseTo(-hi)
  })
})

describe('sectionRoomLayout', () => {
  const slots = sectionRoomLayout()

  it('lays out all 9 rooms once', () => {
    expect(slots.map((s) => s.roomNumber).sort((a, b) => Number(a) - Number(b)))
      .toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9'])
  })

  it('puts 1,3,7,9 on the right of the corridor and 2,4,5,6,8 on the left', () => {
    const side = (n: string) => slots.find((s) => s.roomNumber === n)!.side
    for (const n of ['1', '3', '7', '9']) expect(side(n)).toBe('right')
    for (const n of ['2', '4', '5', '6', '8']) expect(side(n)).toBe('left')
  })

  it('clears the corridor on x and carries the template capacities', () => {
    for (const s of slots) expect(Math.abs(s.x)).toBeGreaterThan(CORRIDOR_W / 2)
    expect(slots.find((s) => s.roomNumber === '1')!.capacity).toBe(4)
    expect(slots.find((s) => s.roomNumber === '5')!.capacity).toBe(8)
    expect(slots.find((s) => s.roomNumber === '6')!.capacity).toBe(6)
  })
})
