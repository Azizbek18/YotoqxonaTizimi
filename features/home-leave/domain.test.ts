import { describe, expect, it } from 'vitest'
import { classifyOverdue, distanceKm, initialLeaveStatus, leaveDays, leaveInEffect, parseLeaveInput } from './domain'

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

describe('classifyOverdue', () => {
  const leaves = [
    { id: 'a', student_id: 's1', ends_on: '2026-10-10' },
    { id: 'b', student_id: 's2', ends_on: '2026-10-10' },
    { id: 'c', student_id: 's3', ends_on: '2026-10-10' },
  ]
  const rec = (student_id: string, state: string, scheduled_for: string, session_status: string) => ({ student_id, state, scheduled_for, session_status })

  it('marks a student returned once present in any roll-call after the leave ended', () => {
    const out = classifyOverdue(leaves, [rec('s1', 'unmarked', '2026-10-11', 'closed'), rec('s1', 'present', '2026-10-12', 'closed')])
    expect(out.returned.has('a')).toBe(true)
    expect(out.overdue.has('a')).toBe(false)
  })
  it('flags overdue only after a roll-call after the leave CLOSED without the student present', () => {
    const out = classifyOverdue(leaves, [
      rec('s2', 'unmarked', '2026-10-11', 'auto_closed'),
      rec('s3', 'unmarked', '2026-10-11', 'open'), // still running — no verdict yet
    ])
    expect(out.overdue.has('b')).toBe(true)
    expect(out.overdue.has('c')).toBe(false)
    expect(out.returned.size).toBe(0)
  })
  it('ignores roll-calls on or before the last leave day (the leave covered them)', () => {
    const out = classifyOverdue(leaves, [rec('s2', 'excused', '2026-10-10', 'closed')])
    expect(out.overdue.size).toBe(0)
  })
})
