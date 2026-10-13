import { describe, expect, it } from 'vitest'
import { admissionYearFor } from './admission-year'

describe('admissionYearFor', () => {
  const oct2026 = new Date('2026-10-13')
  it('reads the admission year from the group code', () => {
    expect(admissionYearFor('TMI-2301', 4, oct2026)).toBe(2023)
    expect(admissionYearFor('AMIT 2502-guruh', 2, oct2026)).toBe(2025)
  })
  it('falls back to course + academic year when the group has no year', () => {
    expect(admissionYearFor('—', 4, oct2026)).toBe(2023)
    expect(admissionYearFor(undefined, 1, new Date('2027-03-01'))).toBe(2026)
  })
  it('ignores an implausible group year', () => {
    expect(admissionYearFor('X-9901', 2, oct2026)).toBe(2025)
  })
})
