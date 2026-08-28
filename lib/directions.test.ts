import { describe, expect, it } from 'vitest'
import {
  ALL_DIRECTIONS,
  FACULTY_DIRECTIONS,
  directionBelongsToFaculty,
  directionLabel,
  directionsForFaculty,
  isDirectionValue,
  normalizeDirection,
} from './directions'
import { PERMIT_FACULTIES } from './faculties'

describe('normalizeDirection', () => {
  it('collapses the slug and the free-typed spelling onto one value', () => {
    // The exact drift this module exists to fix.
    expect(normalizeDirection('amaliy-matematika')).toBe('amaliy-matematika')
    expect(normalizeDirection('Amaliy matematika')).toBe('amaliy-matematika')
    expect(normalizeDirection('  AMALIY   MATEMATIKA ')).toBe('amaliy-matematika')
  })

  it('treats the different Uzbek apostrophes as the same character', () => {
    expect(normalizeDirection('Sun’iy intellekt')).toBe('suniy-intellekt')
    expect(normalizeDirection("Sun'iy intellekt")).toBe('suniy-intellekt')
    expect(normalizeDirection('suniy-intellekt')).toBe('suniy-intellekt')
    expect(normalizeDirection('O‘zbekiston tarixi')).toBe('uzbekiston-tarixi')
  })

  it('returns null for unknown or empty input', () => {
    expect(normalizeDirection('Kosmonavtika')).toBeNull()
    expect(normalizeDirection('')).toBeNull()
    expect(normalizeDirection(null)).toBeNull()
    expect(isDirectionValue('Kosmonavtika')).toBe(false)
  })

  it('recognises directions from faculties the permit flow no longer offers', () => {
    // Rows created before the faculty list was unified must still resolve.
    expect(normalizeDirection('Sotsiologiya')).toBe('sotsiologiya')
    expect(normalizeDirection('Radio jurnalistikasi')).toBe('radio')
  })
})

describe('directionLabel', () => {
  it('renders a stored value as readable text', () => {
    expect(directionLabel('amaliy-matematika')).toBe('Amaliy matematika')
    expect(directionLabel('Amaliy matematika')).toBe('Amaliy matematika')
  })

  it('passes unknown values through instead of hiding them', () => {
    expect(directionLabel('301-guruh')).toBe('301-guruh')
    expect(directionLabel(null)).toBe('')
  })
})

describe('directionsForFaculty', () => {
  it('covers every canonical faculty', () => {
    for (const faculty of PERMIT_FACULTIES) {
      expect(FACULTY_DIRECTIONS[faculty.value].length).toBeGreaterThan(0)
    }
  })

  it('is case-insensitive and falls back to the full list', () => {
    expect(directionsForFaculty('AMIT')).toEqual(FACULTY_DIRECTIONS.amit)
    expect(directionsForFaculty('nomavjud')).toEqual(ALL_DIRECTIONS)
    expect(directionsForFaculty(null)).toEqual(ALL_DIRECTIONS)
  })

  it('offers only values that normalize back to themselves', () => {
    for (const option of ALL_DIRECTIONS) {
      expect(normalizeDirection(option.value)).toBe(option.value)
      expect(normalizeDirection(option.label)).toBe(option.value)
    }
  })
})

describe('directionBelongsToFaculty', () => {
  it('accepts a faculty’s own direction (by value or label, any case)', () => {
    expect(directionBelongsToFaculty('amit', 'suniy-intellekt')).toBe(true)
    expect(directionBelongsToFaculty('AMIT', 'Sun’iy intellekt')).toBe(true)
  })

  it('rejects a direction from another faculty', () => {
    expect(directionBelongsToFaculty('fizika', 'suniy-intellekt')).toBe(false)
    expect(directionBelongsToFaculty('kimyo', 'astronomiya')).toBe(false)
  })

  it('rejects blank or unknown directions', () => {
    expect(directionBelongsToFaculty('amit', '')).toBe(false)
    expect(directionBelongsToFaculty('amit', '301-guruh')).toBe(false)
  })

  it('allows any valid direction for an unknown/legacy faculty code', () => {
    expect(directionBelongsToFaculty('nomavjud', 'suniy-intellekt')).toBe(true)
  })

  it('accepts the teaching directions added for the two philology faculties', () => {
    expect(directionBelongsToFaculty('ozbek-filologiyasi', 'filologiya-ozbek')).toBe(true)
    expect(directionBelongsToFaculty('ozbek-filologiyasi', 'jurnalistika-internet')).toBe(true)
    expect(directionBelongsToFaculty('xorijiy-filologiya', 'filologiya-ingliz')).toBe(true)
    expect(directionBelongsToFaculty('xorijiy-filologiya', 'tarjima-nemis')).toBe(true)
    // still strict: another faculty's programme is rejected
    expect(directionBelongsToFaculty('xorijiy-filologiya', 'suniy-intellekt')).toBe(false)
  })
})
