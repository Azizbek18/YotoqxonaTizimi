import { describe, expect, it } from 'vitest'
import {
  bucketOf,
  daysLeft,
  dueReminder,
  matchesMilestoneFilter,
  tashkentToday,
} from './expiry'

describe('tashkentToday', () => {
  it('rolls to the next day for a late-evening UTC time', () => {
    // 2026-03-01 20:30 UTC → 2026-03-02 01:30 Tashkent
    expect(tashkentToday(new Date('2026-03-01T20:30:00Z'))).toBe('2026-03-02')
  })
  it('stays on the same day earlier in the UTC day', () => {
    expect(tashkentToday(new Date('2026-03-01T10:00:00Z'))).toBe('2026-03-01')
  })
})

describe('daysLeft', () => {
  it('is 0 on the expiry day, negative after', () => {
    expect(daysLeft('2026-05-10', '2026-05-10')).toBe(0)
    expect(daysLeft('2026-05-10', '2026-05-09')).toBe(1)
    expect(daysLeft('2026-05-10', '2026-05-13')).toBe(-3)
  })
})

describe('bucketOf', () => {
  it.each([
    [-1, 'expired'],
    [0, 'critical'],
    [3, 'critical'],
    [4, 'warning'],
    [10, 'warning'],
    [11, 'soon'],
    [30, 'soon'],
    [31, 'ok'],
  ] as const)('days %i → %s', (days, bucket) => {
    expect(bucketOf(days)).toBe(bucket)
  })
})

describe('matchesMilestoneFilter', () => {
  it('partitions the ranges so a day lands in exactly one bucket', () => {
    const filters = ['30', '15', '10', '5', '3', '0', 'expired'] as const
    for (let d = -5; d <= 40; d += 1) {
      const hits = filters.filter((f) => matchesMilestoneFilter(d, f))
      expect(hits.length).toBeLessThanOrEqual(1)
    }
  })
  it('maps representative days correctly', () => {
    expect(matchesMilestoneFilter(25, '30')).toBe(true)
    expect(matchesMilestoneFilter(15, '15')).toBe(true)
    expect(matchesMilestoneFilter(16, '15')).toBe(false)
    expect(matchesMilestoneFilter(2, '3')).toBe(true)
    expect(matchesMilestoneFilter(0, '0')).toBe(true)
    expect(matchesMilestoneFilter(0, '3')).toBe(false)
    expect(matchesMilestoneFilter(-2, 'expired')).toBe(true)
  })
})

describe('dueReminder', () => {
  const empty = new Set<number>()

  it('fires once and marks every crossed milestone when a doc is added close to expiry', () => {
    const r = dueReminder(2, empty)
    expect(r.send).toBe(true)
    expect(r.postExpiryDay).toBeNull()
    expect(new Set(r.mark)).toEqual(new Set([30, 15, 10, 5, 3]))
  })

  it('does not re-fire a milestone already sent', () => {
    const sent = new Set([30, 15, 10])
    // day 12 → due milestones [30,15] already sent, nothing new
    expect(dueReminder(12, sent)).toEqual({ send: false, mark: [], postExpiryDay: null })
  })

  it('fires the newly-due milestone as the countdown advances', () => {
    const sent = new Set([30, 15, 10, 5])
    const r = dueReminder(3, sent) // 3-day milestone now due
    expect(r.send).toBe(true)
    expect(r.mark).toEqual([3])
  })

  it('still catches a milestone even if a cron day was skipped', () => {
    // Cron missed day 5; next run sees day 4. The 5-milestone is still due
    // (4 <= 5) and unsent, so it fires.
    const sent = new Set([30, 15, 10])
    const r = dueReminder(4, sent)
    expect(r.send).toBe(true)
    expect(new Set(r.mark)).toEqual(new Set([5]))
  })

  it('emits the exact-day (0) reminder', () => {
    const sent = new Set([30, 15, 10, 5, 3])
    expect(dueReminder(0, sent)).toEqual({ send: true, mark: [0], postExpiryDay: null })
  })

  it('sends a daily post-expiry reminder within the grace window', () => {
    expect(dueReminder(-1, empty)).toEqual({ send: true, mark: [-1], postExpiryDay: 1 })
    expect(dueReminder(-7, new Set([-1, -2, -3, -4, -5, -6]))).toEqual({
      send: true,
      mark: [-7],
      postExpiryDay: 7,
    })
  })

  it('stops post-expiry reminders after the grace window', () => {
    expect(dueReminder(-8, empty)).toEqual({ send: false, mark: [], postExpiryDay: null })
  })

  it('does not repeat a post-expiry day already sent', () => {
    expect(dueReminder(-3, new Set([-3]))).toEqual({ send: false, mark: [], postExpiryDay: null })
  })
})
