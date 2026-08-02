import { describe, expect, it } from 'vitest'
import {
  STUDENT_REPORT_HEADERS,
  STUDENT_REPORT_ROOM_CAPACITY,
  buildStudentReportCsv,
  buildStudentReportTable,
  formatReportDate,
  reportGenderLabel,
  type StudentReportRow,
} from './student-report-table'

const student = (overrides: StudentReportRow = {}): StudentReportRow => ({
  full_name: 'Test Talaba',
  room_number: '12',
  gender: 'male',
  course: 2,
  ...overrides,
})

describe('buildStudentReportTable', () => {
  it('emits one column per header', () => {
    const { rawRows } = buildStudentReportTable([student()])
    expect(rawRows).toHaveLength(STUDENT_REPORT_ROOM_CAPACITY)
    for (const row of rawRows) {
      expect(row).toHaveLength(STUDENT_REPORT_HEADERS.length)
    }
  })

  it('pads every room out to its full capacity with blank rows', () => {
    const { rawRows } = buildStudentReportTable([
      student({ full_name: 'Birinchi', room_number: '5' }),
      student({ full_name: 'Ikkinchi', room_number: '5' }),
    ])

    expect(rawRows).toHaveLength(STUDENT_REPORT_ROOM_CAPACITY)
    expect(rawRows[0][3]).toBe('Birinchi')
    expect(rawRows[1][3]).toBe('Ikkinchi')
    // The two free beds carry the room, but no student data and no sequence number.
    expect(rawRows[2][0]).toBe('')
    expect(rawRows[2][2]).toBe('№-5')
    expect(rawRows[2][3]).toBe('')
  })

  it('sorts rooms numerically, not lexicographically', () => {
    const { rawRows } = buildStudentReportTable([
      student({ room_number: '10' }),
      student({ room_number: '2' }),
    ])
    expect(rawRows[0][2]).toBe('№-2')
    expect(rawRows[STUDENT_REPORT_ROOM_CAPACITY][2]).toBe('№-10')
  })

  it('merges repeated floor/room cells and blanks them only in displayRows', () => {
    const { rawRows, displayRows, merges } = buildStudentReportTable([
      student({ room_number: '7' }),
      student({ room_number: '7' }),
    ])

    // Room column stays populated for CSV…
    expect(rawRows.every((row) => row[2] === '№-7')).toBe(true)
    // …but is blanked below the first row where a merge covers it.
    expect(displayRows[0][2]).toBe('№-7')
    expect(displayRows[1][2]).toBe('')

    const roomMerge = merges.find((merge) => merge.s.c === 2)
    expect(roomMerge).toBeDefined()
    // +1 offsets the header row; the merge spans all 4 capacity rows.
    expect(roomMerge).toEqual({ s: { r: 1, c: 2 }, e: { r: STUDENT_REPORT_ROOM_CAPACITY, c: 2 } })
  })

  it('does not pad or merge students who have no room', () => {
    const { rawRows, merges } = buildStudentReportTable([student({ room_number: null })])
    expect(rawRows).toHaveLength(1)
    expect(rawRows[0][2]).toBe('-')
    expect(merges).toHaveLength(0)
  })

  it('lists roomless students after every housed room', () => {
    const { rawRows } = buildStudentReportTable([
      student({ full_name: 'Xonasiz', room_number: null }),
      student({ full_name: 'Joylashgan', room_number: '3' }),
    ])

    expect(rawRows[0][3]).toBe('Joylashgan')
    // Room 3 pads out to capacity first, then the roomless row closes the sheet.
    expect(rawRows).toHaveLength(STUDENT_REPORT_ROOM_CAPACITY + 1)
    const last = rawRows[rawRows.length - 1]
    expect(last[2]).toBe('-')
    expect(last[3]).toBe('Xonasiz')
  })

  it('normalizes dates, gender and apostrophes', () => {
    const { rawRows } = buildStudentReportTable([
      student({ full_name: 'Aʼzam  Gʻofurov', gender: 'female', birth_date: '2004-03-09' }),
    ])
    expect(rawRows[0][3]).toBe("A'zam G'ofurov")
    expect(rawRows[0][17]).toBe('Ayol')
    expect(rawRows[0][11]).toBe('09.03.2004')
  })
})

describe('formatReportDate', () => {
  it('reformats ISO dates and passes anything else through', () => {
    expect(formatReportDate('2026-01-31T00:00:00Z')).toBe('31.01.2026')
    expect(formatReportDate(null)).toBe('-')
    expect(formatReportDate('noma‘lum')).toBe('noma‘lum')
  })
})

describe('reportGenderLabel', () => {
  it('maps stored codes and legacy Uzbek values', () => {
    expect(reportGenderLabel('male')).toBe('Erkak')
    expect(reportGenderLabel('Ayol')).toBe('Ayol')
    expect(reportGenderLabel(null)).toBe('-')
  })
})

describe('buildStudentReportCsv', () => {
  it('escapes quotes and neutralizes formula-injection cells', () => {
    const csv = buildStudentReportCsv(['A', 'B'], [['=SUM(1)', 'he said "hi"']])
    expect(csv.split('\n')[0]).toBe('sep=,')
    expect(csv).toContain('"\'=SUM(1)"')
    expect(csv).toContain('"he said ""hi"""')
  })
})
