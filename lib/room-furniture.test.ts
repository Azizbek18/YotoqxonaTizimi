import { describe, expect, it } from 'vitest'
import { bunkCount, FURNITURE_COLORS, roomFurniture, type FurnitureRoom } from './room-furniture'

const room = (over: Partial<FurnitureRoom> = {}): FurnitureRoom => ({
  x: -2.5, z: 0, width: 1.8, depth: 1.3, capacity: 4, occupied: 0, frozen: false, ...over,
})

const mattresses = (r: FurnitureRoom) => roomFurniture(r).filter((b) => b.kind === 'mattress')

describe('bunkCount', () => {
  it('two places per bunk bed, rounded up', () => {
    expect(bunkCount(4)).toBe(2)
    expect(bunkCount(3)).toBe(2)
    expect(bunkCount(2)).toBe(1)
    expect(bunkCount(6)).toBe(3)
  })

  it('draws a standard room when capacity is unknown, and caps very large rooms', () => {
    expect(bunkCount(null)).toBe(2)
    expect(bunkCount(0)).toBe(2)
    expect(bunkCount(20)).toBe(4)
  })
})

describe('roomFurniture', () => {
  it('one mattress per place; an odd capacity leaves the last upper deck bare', () => {
    expect(mattresses(room({ capacity: 4 }))).toHaveLength(4)
    expect(mattresses(room({ capacity: 3 }))).toHaveLength(3)
  })

  it('marks the first `occupied` places as taken', () => {
    const colors = mattresses(room({ capacity: 4, occupied: 3 })).map((m) => m.color)
    expect(colors.filter((c) => c === FURNITURE_COLORS.mattressTaken)).toHaveLength(3)
    expect(colors.filter((c) => c === FURNITURE_COLORS.mattressFree)).toHaveLength(1)
  })

  it('greys out every mattress in a frozen room', () => {
    const colors = mattresses(room({ frozen: true, occupied: 2 })).map((m) => m.color)
    expect(new Set(colors)).toEqual(new Set([FURNITURE_COLORS.mattressFrozen]))
  })

  it('has a desk and chairs', () => {
    const boxes = roomFurniture(room())
    expect(boxes.some((b) => b.kind === 'wood')).toBe(true)
    expect(boxes.some((b) => b.kind === 'chair')).toBe(true)
  })

  it.each([
    ['left small', room({ x: -2.5, depth: 1.3 })],
    ['right medium', room({ x: 2.5, depth: 1.8, capacity: 6, occupied: 5 })],
    ['right large', room({ x: 2.5, depth: 2.6, capacity: 8 })],
  ])('keeps every piece inside the room footprint (%s)', (_label, r) => {
    for (const b of roomFurniture(r, 0x10b981)) {
      expect(b.x - b.sx / 2).toBeGreaterThanOrEqual(r.x - r.width / 2 - 1e-9)
      expect(b.x + b.sx / 2).toBeLessThanOrEqual(r.x + r.width / 2 + 1e-9)
      expect(b.z - b.sz / 2).toBeGreaterThanOrEqual(r.z - r.depth / 2 - 1e-9)
      expect(b.z + b.sz / 2).toBeLessThanOrEqual(r.z + r.depth / 2 + 1e-9)
      expect(b.y + b.sy / 2).toBeLessThanOrEqual(1)
    }
  })

  it('puts the desk on the window side, away from the corridor', () => {
    const left = roomFurniture(room({ x: -2.5 })).find((b) => b.kind === 'wood' && b.sy < 0.05)!
    const right = roomFurniture(room({ x: 2.5 })).find((b) => b.kind === 'wood' && b.sy < 0.05)!
    // Left of the corridor the window is the far (more negative) end, and vice versa.
    expect(left.x).toBeLessThan(-2.5)
    expect(right.x).toBeGreaterThan(2.5)
  })
})
