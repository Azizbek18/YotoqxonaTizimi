import { describe, expect, it } from 'vitest'
import { sectionOccupancy, sectionPlacement, BLOCK_GAP } from './blocked-building-3d'
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

  it('empty section', () => {
    expect(sectionOccupancy([])).toEqual({ filled: 0, total: 0 })
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

  it('stacks floors bottom-to-top, centred on y=0', () => {
    const lo = sectionPlacement('A', 1, 2, 12).y
    const mid = sectionPlacement('A', 6, 2, 12).y
    const hi = sectionPlacement('A', 12, 2, 12).y
    expect(lo).toBeLessThan(mid)
    expect(mid).toBeLessThan(hi)
    expect(lo).toBeCloseTo(-hi) // symmetric about the middle
  })
})
