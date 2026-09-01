import { describe, expect, it } from 'vitest'
import {
  attendanceClosesAt,
  attendanceWindowJustOpened,
  isWithinAttendanceWindow,
  tashkentDateString,
  tashkentInstant,
  tashkentMinutesOfDay,
} from './tashkent-time'

// 2026-09-01T17:30:00Z == 2026-09-01 22:30 Toshkent
const eveningUtc = new Date('2026-09-01T17:30:00Z')
// 2026-09-01T19:10:00Z == 2026-09-02 00:10 Toshkent (next calendar day)
const pastMidnightUtc = new Date('2026-09-01T19:10:00Z')

describe('tashkent-time', () => {
  it('shifts to the +5 wall clock and calendar date', () => {
    expect(tashkentMinutesOfDay(eveningUtc)).toBe(22 * 60 + 30)
    expect(tashkentDateString(eveningUtc)).toBe('2026-09-01')
    expect(tashkentDateString(pastMidnightUtc)).toBe('2026-09-02')
  })

  it('detects the open window and its crossing-midnight case', () => {
    expect(isWithinAttendanceWindow('21:00', '23:00', eveningUtc)).toBe(true)
    expect(isWithinAttendanceWindow('21:00', '22:00', eveningUtc)).toBe(false)
    // 23:00 -> 01:00 window, now is 00:10 Toshkent
    expect(isWithinAttendanceWindow('23:00', '01:00', pastMidnightUtc)).toBe(true)
    expect(isWithinAttendanceWindow('21:00', '23:00', pastMidnightUtc)).toBe(false)
  })

  it('fires "just opened" only in the grace minutes after open', () => {
    // 20:55 Toshkent -> before 21:00 open
    expect(attendanceWindowJustOpened('21:00', new Date('2026-09-01T15:55:00Z'))).toBe(false)
    // 21:10 Toshkent -> within 20-min grace
    expect(attendanceWindowJustOpened('21:00', new Date('2026-09-01T16:10:00Z'))).toBe(true)
    // 21:30 Toshkent -> past the grace
    expect(attendanceWindowJustOpened('21:00', new Date('2026-09-01T16:30:00Z'))).toBe(false)
  })

  it('builds the correct UTC instant for a Toshkent local time', () => {
    expect(tashkentInstant('2026-09-01', '23:00').toISOString()).toBe('2026-09-01T18:00:00.000Z')
  })

  it('closes same-day for a normal window, next-day when it crosses midnight', () => {
    expect(attendanceClosesAt('2026-09-01', '21:00', '23:00').toISOString())
      .toBe('2026-09-01T18:00:00.000Z')
    // opens 2026-09-01 23:00, closes 2026-09-02 01:00 Toshkent == 2026-09-01 20:00 UTC
    expect(attendanceClosesAt('2026-09-01', '23:00', '01:00').toISOString())
      .toBe('2026-09-01T20:00:00.000Z')
  })
})
