import { describe, expect, it } from 'vitest'
import {
  getFreePlaces,
  getPaymentStats,
  getPaymentYears,
  getRoomOccupancyTone,
  getTashkentYear,
} from './presentation'

describe('app settings presentation helpers', () => {
  it('does not guess occupancy status without a capacity', () => {
    expect(getRoomOccupancyTone(0, null)).toBe('empty')
    expect(getRoomOccupancyTone(1, null)).toBe('unknown')
    expect(getRoomOccupancyTone(3, 4)).toBe('partial')
    expect(getRoomOccupancyTone(4, 4)).toBe('full')
  })

  it('never displays a negative number of free places', () => {
    expect(getFreePlaces(null, 3)).toBeNull()
    expect(getFreePlaces(4, 2)).toBe(2)
    expect(getFreePlaces(2, 4)).toBe(0)
  })

  it('does not calculate financial totals without the real contract fee', () => {
    expect(getPaymentStats(null, 500_000)).toBeNull()
    expect(getPaymentStats(3_000_000, 750_000)).toEqual({
      totalContractFee: 3_000_000,
      remainingAmount: 2_250_000,
      progressPercent: 25,
    })
    expect(getPaymentStats(3_000_000, 4_000_000)?.progressPercent).toBe(100)
  })

  it('builds the year selector from the current Tashkent year', () => {
    const utcNewYearBoundary = new Date('2026-12-31T20:00:00.000Z')
    expect(getTashkentYear(utcNewYearBoundary)).toBe(2027)
    expect(getPaymentYears(utcNewYearBoundary)).toEqual([2026, 2027, 2028])
  })
})
