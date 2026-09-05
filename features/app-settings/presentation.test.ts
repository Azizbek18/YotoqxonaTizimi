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
    // It's Tashkent Yanvar 2027 here — still inside the academic year that
    // started Sentabr 2026, so the middle tab must stay 2026, not jump to
    // 2027 just because the calendar flipped.
    expect(getPaymentYears(utcNewYearBoundary)).toEqual([2025, 2026, 2027])
  })

  it('rolls the academic year over once Sentabr arrives', () => {
    const septemberStart = new Date('2026-09-01T00:00:00.000Z') // Tashkent 05:00, still Sentabr
    expect(getPaymentYears(septemberStart)).toEqual([2025, 2026, 2027])

    const augustEnd = new Date('2026-08-31T18:00:00.000Z') // Tashkent 23:00, still Avgust
    expect(getPaymentYears(augustEnd)).toEqual([2024, 2025, 2026])
  })
})
