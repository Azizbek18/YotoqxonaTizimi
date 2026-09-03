import { describe, expect, it } from 'vitest'
import { checkFloorPlacement, computeFloorBalance } from './floor-balance'

describe('computeFloorBalance', () => {
  it('targets are capacity-proportional to the overall course mix', () => {
    const b = computeFloorBalance({
      floors: [{ floor: 1, capacity: 30 }, { floor: 2, capacity: 30 }, { floor: 3, capacity: 60 }],
      placed: [],
      totalToHouse: { 1: 40, 2: 40, 3: 20, 4: 20 },
    })
    // floor 3 = 60/120 of the beds -> half of every course
    expect(b.floors.find((f) => f.floor === 3)!.targetByCourse).toEqual({ 1: 20, 2: 20, 3: 10, 4: 10 })
    // floor 1 = 30/120 -> a quarter
    expect(b.floors.find((f) => f.floor === 1)!.targetByCourse).toEqual({ 1: 10, 2: 10, 3: 5, 4: 5 })
    expect(b.totalCapacity).toBe(120)
  })

  it('over / under detection with a realistic two-floor split', () => {
    // 2 floors, 20 beds each. 20 students to house: 10 course-1, 10 course-2.
    // target per floor = 5 course-1, 5 course-2.
    const b = computeFloorBalance({
      floors: [{ floor: 1, capacity: 20 }, { floor: 2, capacity: 20 }],
      placed: [
        ...Array.from({ length: 9 }, () => ({ floor: 1, course: 1 })), // 9 vs target 5 -> over
        ...Array.from({ length: 1 }, () => ({ floor: 1, course: 2 })), // 1 vs 5 -> under
      ],
      totalToHouse: { 1: 10, 2: 10, 3: 0, 4: 0 },
    })
    const f1 = b.floors[0]
    expect(f1.statusByCourse[1]).toBe('over')
    expect(f1.statusByCourse[2]).toBe('under')
    expect(f1.worst).toEqual({ course: 1, kind: 'over', delta: 4 })
  })

  it('leaves a near-empty floor alone (no false "kam")', () => {
    const b = computeFloorBalance({
      floors: [{ floor: 1, capacity: 40 }],
      placed: [{ floor: 1, course: 1 }, { floor: 1, course: 1 }, { floor: 1, course: 1 }], // 3 < max(4, 8)
      totalToHouse: { 1: 40, 2: 40, 3: 40, 4: 40 },
    })
    expect(b.floors[0].worst).toBeNull()
    expect(Object.values(b.floors[0].statusByCourse)).toEqual(['ok', 'ok', 'ok', 'ok'])
  })
})

describe('checkFloorPlacement', () => {
  const balance = () => computeFloorBalance({
    floors: [{ floor: 1, capacity: 20 }, { floor: 2, capacity: 20 }],
    placed: [
      ...Array.from({ length: 8 }, () => ({ floor: 1, course: 1 })), // target 5
      ...Array.from({ length: 1 }, () => ({ floor: 1, course: 4 })), // target 5 -> under by 4
    ],
    totalToHouse: { 1: 10, 2: 0, 3: 0, 4: 10 },
  })

  it('warns and suggests the scarce course when it has an available student', () => {
    const r = checkFloorPlacement(balance(), 1, 1, { availableByCourse: { 4: 3 } })!
    expect(r.wouldOverfill).toBe(true)
    expect(r.suggestion).toEqual({ course: 4, gap: 4, available: 3 })
  })

  it('warns but gives no suggestion when the scarce course has nobody available', () => {
    const r = checkFloorPlacement(balance(), 1, 1, { availableByCourse: { 4: 0 } })!
    expect(r.wouldOverfill).toBe(true)
    expect(r.suggestion).toBeNull()
  })

  it('does not warn when placing the course the floor is short on', () => {
    const r = checkFloorPlacement(balance(), 1, 4, { availableByCourse: { 1: 5 } })!
    expect(r.wouldOverfill).toBe(false)
  })

  it('returns null for an unknown floor', () => {
    expect(checkFloorPlacement(balance(), 99, 1)).toBeNull()
  })
})
