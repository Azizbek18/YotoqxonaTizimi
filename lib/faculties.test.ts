import { describe, expect, it } from 'vitest'
import {
  PERMIT_FACULTIES,
  isPermitFacultyValue,
  normalizeFaculty,
  permitFacultyLabel,
} from './faculties'
import { FACULTY_DIRECTIONS } from './directions'

describe('PERMIT_FACULTIES', () => {
  it('holds the 13 NUU faculties with unique codes', () => {
    expect(PERMIT_FACULTIES).toHaveLength(13)
    const codes = PERMIT_FACULTIES.map((f) => f.value)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('keeps the pre-existing codes so their rows need no migration', () => {
    for (const code of ['amit', 'fizika', 'kimyo', 'tarix', 'biologiya'] as const) {
      expect(isPermitFacultyValue(code)).toBe(true)
    }
  })

  it('has a direction vocabulary for every faculty', () => {
    for (const faculty of PERMIT_FACULTIES) {
      expect(FACULTY_DIRECTIONS[faculty.value].length).toBeGreaterThan(0)
    }
  })
})

describe('normalizeFaculty', () => {
  it('returns a canonical code unchanged', () => {
    expect(normalizeFaculty('amit')).toBe('amit')
    expect(normalizeFaculty('ijtimoiy-fanlar')).toBe('ijtimoiy-fanlar')
  })

  it('resolves free-typed and legacy spellings', () => {
    expect(normalizeFaculty('AMIT')).toBe('amit')
    expect(normalizeFaculty('  Amaliy matematika ')).toBe('amit')
    expect(normalizeFaculty('Biologiya va ekologiya')).toBe('biologiya')
    expect(normalizeFaculty('Taekvondo')).toBe('sport')
    expect(normalizeFaculty('Jurnalistika va o‘zbek filologiyasi')).toBe('ozbek-filologiyasi')
  })

  it('returns null for an unknown faculty', () => {
    expect(normalizeFaculty('Kosmik fanlar')).toBeNull()
    expect(normalizeFaculty('')).toBeNull()
    expect(normalizeFaculty(null)).toBeNull()
  })
})

describe('permitFacultyLabel', () => {
  it('renders a code as its full name', () => {
    expect(permitFacultyLabel('amit')).toBe('Amaliy matematika va intellektual texnologiyalar')
    expect(permitFacultyLabel('sport')).toBe('Taekvondo va sport faoliyati')
  })

  it('renders a legacy spelling as the canonical name', () => {
    expect(permitFacultyLabel('AMIT')).toBe('Amaliy matematika va intellektual texnologiyalar')
  })

  it('passes an unknown value through instead of hiding it', () => {
    expect(permitFacultyLabel('Kosmik fanlar')).toBe('Kosmik fanlar')
    expect(permitFacultyLabel(null)).toBe('')
  })
})
