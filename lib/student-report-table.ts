import { directionLabel } from '@/lib/directions'
import { extractFloor } from '@/lib/floor'
import { sanitizeSpreadsheetCell, type SpreadsheetMerge } from '@/lib/spreadsheet-export'

/**
 * The single definition of the students report sheet, shared by the admin
 * "Hisobotlar" page and the dekan "Hisobot va eksport" page. Both panels
 * hand out the same document to the same institution, so the column list,
 * the room grouping and the empty-bed padding must not be able to drift
 * apart — duplicating this once per panel is exactly how they would.
 */

// Structurally loose on purpose: admin passes `UserRow` (every field
// nullable) and dekan passes `PlacedStudentRow`. Both satisfy this.
export type StudentReportRow = {
  full_name?: string | null
  room_number?: string | null
  region?: string | null
  district?: string | null
  mahalla?: string | null
  passport_series?: string | null
  jshshir?: string | null
  passport_date?: string | null
  birth_date?: string | null
  faculty?: string | null
  direction?: string | null
  course?: number | string | null
  nationality?: string | null
  study_type?: string | null
  gender?: string | null
  phone?: string | null
  phone_number?: string | null
  entry_date?: string | null
  father_full_name?: string | null
  father_workplace?: string | null
  father_phone?: string | null
  mother_full_name?: string | null
  mother_workplace?: string | null
  mother_phone?: string | null
}

export const STUDENT_REPORT_HEADERS = [
  '№',
  'Qavati',
  'Xona raqami',
  'F.I.Sh.',
  'Viloyati',
  'Tumani',
  'MFY',
  'Shartnoma raqami',
  'Pasport seriya raqami',
  'JSHSHIR',
  'Pasport berilgan vaqti',
  "Tug'ilgan kun, oy, yil",
  'Fakulteti',
  "Yo'nalish",
  'Kursi',
  'Millati',
  'Moliya turi',
  'Jinsi',
  'Telefon raqami',
  'Ijtimoiy holati',
  'Ish joyi',
  'Ish vaqti',
  'TTJga joylashgan oyi',
  'TTJdan chiqib ketgan sanasi',
  'Tyutor',
  'Telefon raqami',
  'Otasining ismi va familiyasi',
  'Ish joyi',
  'Telefon nomeri',
  'Onasining ismi va familiyasi',
  'Onasining ish joyi',
  'Telefon nomeri',
]

export const STUDENT_REPORT_ROOM_CAPACITY = 4

/** Apostroflar va ortiqcha bo'shliqlarni bir ko'rinishga keltiradi. */
export function cleanReportText(value: unknown) {
  return String(value ?? '')
    .replace(/[ʻʼ‘’`‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/** "YYYY-MM-DD" → "DD.MM.YYYY". */
export function formatReportDate(value?: string | null) {
  if (!value) return '-'
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return value
  return `${match[3]}.${match[2]}.${match[1]}`
}

export function reportGenderLabel(value?: string | null) {
  if (value === 'male' || value === 'Erkak') return 'Erkak'
  if (value === 'female' || value === 'Ayol') return 'Ayol'
  return value || '-'
}

// The 29 columns that follow №/Qavati/Xona raqami. Several of them are
// placeholders: the corresponding data simply isn't stored in this system,
// but the column has to exist because the sheet is handed over in a fixed
// institutional format.
function buildFields(student: StudentReportRow) {
  return [
    cleanReportText(student.full_name || '-'),
    cleanReportText(student.region || '-'),
    cleanReportText(student.district || '-'),
    cleanReportText(student.mahalla || '-'),
    '-', // Shartnoma raqami — tizimda saqlanmaydi
    cleanReportText(student.passport_series || '-'),
    cleanReportText(student.jshshir || '-'),
    cleanReportText(formatReportDate(student.passport_date)),
    cleanReportText(formatReportDate(student.birth_date)),
    cleanReportText(student.faculty || '-'),
    // Kanonik qiymat ('amaliy-matematika') o'rniga o'qiladigan nom
    cleanReportText(directionLabel(student.direction) || '-'),
    cleanReportText(student.course || '-'),
    cleanReportText(student.nationality || '-'),
    cleanReportText(student.study_type || '-'),
    cleanReportText(reportGenderLabel(student.gender)),
    cleanReportText(student.phone_number || student.phone || '-'),
    '-', // Ijtimoiy holati — tizimda saqlanmaydi
    '-', // Ish joyi (talabaning o'zi) — tizimda saqlanmaydi
    '-', // Ish vaqti — tizimda saqlanmaydi
    cleanReportText(formatReportDate(student.entry_date)),
    '-', // TTJdan chiqib ketgan sanasi — tizimda saqlanmaydi
    '-', // Tyutor — tizimda saqlanmaydi
    '-', // Tyutor telefon raqami — tizimda saqlanmaydi
    cleanReportText(student.father_full_name || '-'),
    cleanReportText(student.father_workplace || '-'),
    cleanReportText(student.father_phone || '-'),
    cleanReportText(student.mother_full_name || '-'),
    cleanReportText(student.mother_workplace || '-'),
    cleanReportText(student.mother_phone || '-'),
  ]
}

const emptyFields = () => Array<string>(29).fill('')

export type StudentReportTable = {
  headers: string[]
  /** Every cell filled — for CSV, where a blank reads as "no data". */
  rawRows: string[][]
  /** Repeated Qavati/Xona cells blanked, to pair with `merges`. */
  displayRows: string[][]
  merges: SpreadsheetMerge[]
}

/**
 * `floorOf` lets the caller resolve floors from the admin's qavat tarxi
 * (see lib/hooks/useRoomFloors). It defaults to the room-number guess so the
 * pure-function tests and any caller without the map keep their old output.
 */
export function buildStudentReportTable(
  students: readonly StudentReportRow[],
  floorOf: (roomNumber?: string | null) => number | null = extractFloor,
): StudentReportTable {
  // Natural room order (1, 2, 10 …) rather than lexicographic, which also
  // groups floors in ascending order since floors derive from room numbers.
  // Students with no room yet go last: the sheet is organised around rooms,
  // so an empty room cell reads as a trailing "hali joylashtirilmagan"
  // section rather than as a broken first page.
  const sorted = [...students].sort((a, b) => {
    const roomA = a.room_number || ''
    const roomB = b.room_number || ''
    if (!roomA !== !roomB) return roomA ? -1 : 1
    return roomA.localeCompare(roomB, undefined, { numeric: true, sensitivity: 'base' })
  })

  type RoomGroup = { room: string | null; floor: number | null; students: StudentReportRow[] }
  const roomGroups: RoomGroup[] = []
  sorted.forEach((student) => {
    const room = student.room_number || null
    const last = roomGroups[roomGroups.length - 1]
    if (room && last && last.room === room) {
      last.students.push(student)
    } else {
      roomGroups.push({ room, floor: floorOf(student.room_number), students: [student] })
    }
  })

  // A partially filled room still shows its free beds as empty rows, so the
  // printed sheet reflects the actual capacity of each room.
  const rawRows: string[][] = []
  let seq = 1
  roomGroups.forEach((group) => {
    const floorValue = group.floor ? String(group.floor) : '-'
    const roomValue = group.room ? `№-${group.room}` : '-'

    group.students.forEach((student) => {
      rawRows.push([String(seq), floorValue, roomValue, ...buildFields(student)])
      seq++
    })

    if (group.room) {
      const emptySlots = Math.max(0, STUDENT_REPORT_ROOM_CAPACITY - group.students.length)
      for (let k = 0; k < emptySlots; k++) {
        rawRows.push(['', floorValue, roomValue, ...emptyFields()])
      }
    }
  })

  const displayRows = rawRows.map((row) => [...row])
  const merges: SpreadsheetMerge[] = []

  const mergeColumn = (col: number) => {
    let i = 0
    while (i < displayRows.length) {
      const value = displayRows[i][col]
      if (value === '-' || !value) {
        i++
        continue
      }

      let j = i + 1
      while (j < displayRows.length && rawRows[j][col] === value) {
        displayRows[j][col] = '' // blank the repeats the merge will cover
        j++
      }

      if (j - i > 1) {
        merges.push({
          s: { r: i + 1, c: col }, // +1: row 0 is the header
          e: { r: j, c: col },
        })
      }
      i = j
    }
  }

  if (displayRows.length > 0) {
    mergeColumn(1) // Qavati
    mergeColumn(2) // Xona raqami
  }

  return { headers: STUDENT_REPORT_HEADERS, rawRows, displayRows, merges }
}

/**
 * CSV always uses `rawRows`: the merge-blanked cells only carry meaning in
 * a spreadsheet that actually renders the merges, and would otherwise read
 * as missing data.
 */
export function buildStudentReportCsv(headers: string[], rows: string[][]) {
  return [
    'sep=,',
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(sanitizeSpreadsheetCell(cell)).replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n')
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob(['﻿' + content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
