import { describe, expect, it } from 'vitest'
import { distanceKm, initialLeaveStatus, leaveDays, leaveInEffect, parseLeaveInput } from './domain'

const base = {
  destinationKind: 'qarindosh', destinationAddress: 'Samarqand, Urgut tumani', contactName: 'Aliyev Vali',
  contactPhone: '+998 90 123 45 67', startsOn: '2026-10-14', endsOn: '2026-10-17', consent: true,
}

describe('parseLeaveInput', () => {
  it('accepts a relative address and normalises the phone', () => {
    const out = parseLeaveInput(base, '2026-10-13')
    expect(out.contactPhone).toBe('+998901234567')
    expect(out.destinationKind).toBe('qarindosh')
  })
  it('rejects past, inverted, too-long and unconsented requests', () => {
    expect(() => parseLeaveInput({ ...base, startsOn: '2026-10-12' }, '2026-10-13')).toThrow()
    expect(() => parseLeaveInput({ ...base, endsOn: '2026-10-13' }, '2026-10-13')).toThrow()
    expect(() => parseLeaveInput({ ...base, endsOn: '2026-12-30' }, '2026-10-13')).toThrow()
    expect(() => parseLeaveInput({ ...base, consent: false }, '2026-10-13')).toThrow()
    expect(() => parseLeaveInput({ ...base, startsOn: '2026-11-20', endsOn: '2026-11-21' }, '2026-10-13')).toThrow()
  })
  it('requires a contact person with a valid phone', () => {
    expect(() => parseLeaveInput({ ...base, contactPhone: '123' }, '2026-10-13')).toThrow()
    expect(() => parseLeaveInput({ ...base, contactName: '' }, '2026-10-13')).toThrow()
  })
})

describe('leave rules', () => {
  it('counts both the departure and return day', () => {
    expect(leaveDays('2026-10-14', '2026-10-14')).toBe(1)
    expect(leaveDays('2026-10-14', '2026-10-20')).toBe(7)
  })
  it('auto-activates short leaves, sends long or previously suspicious ones to the dekan', () => {
    expect(initialLeaveStatus(7, false)).toBe('active')
    expect(initialLeaveStatus(8, false)).toBe('pending')
    expect(initialLeaveStatus(2, true)).toBe('pending')
  })
  it('is in effect only while active and inside the dates', () => {
    const l = { status: 'active', starts_on: '2026-10-14', ends_on: '2026-10-17' }
    expect(leaveInEffect(l, '2026-10-13')).toBe(false)
    expect(leaveInEffect(l, '2026-10-17')).toBe(true)
    expect(leaveInEffect(l, '2026-10-18')).toBe(false)
    expect(leaveInEffect({ ...l, status: 'pending' }, '2026-10-15')).toBe(false)
  })
  it('measures distance', () => {
    expect(distanceKm({ lat: 41.31, lng: 69.24 }, { lat: 39.65, lng: 66.96 })).toBeGreaterThan(250)
    expect(distanceKm({ lat: 41.31, lng: 69.24 }, { lat: 41.31, lng: 69.24 })).toBe(0)
  })
})
