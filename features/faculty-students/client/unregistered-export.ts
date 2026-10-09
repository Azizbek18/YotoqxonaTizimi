import { downloadXlsx, type SpreadsheetCell } from '@/lib/spreadsheet-export'
import { permitFacultyLabel } from '@/lib/faculties'
import { directionLabel } from '@/lib/directions'
import { genderLabel } from '@/lib/gender'
import type { UnregisteredPermitRow } from '../types'

export const UNREGISTERED_EXPORT_HEADERS = [
  '№',
  'F.I.Sh',
  'Jinsi',
  'Fakultet',
  "Yo'nalish",
  'Kurs',
  "Ta'lim turi",
  'Telefon',
  'Qarindosh telefoni',
  'Email',
  'Pasport',
  'JSHSHIR',
  'Hudud',
  'Yotoqxona',
  'Xona',
  'Ariza sanasi',
]

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('uz-UZ')
}

/** One spreadsheet row per approved-but-unregistered permit holder. */
export function unregisteredExportRows(
  rows: UnregisteredPermitRow[],
  dormLabel: (dormId: string | null) => string,
): SpreadsheetCell[][] {
  return rows.map((row, index) => [
    index + 1,
    row.full_name,
    genderLabel(row.gender) || '',
    permitFacultyLabel(row.faculty) || '',
    directionLabel(row.direction) || '',
    row.course ?? '',
    row.study_type ?? '',
    row.phone ?? '',
    row.relative_phone ?? '',
    row.email ?? '',
    row.passport_series ?? '',
    row.jshshir ?? '',
    [row.origin_region, row.origin_country].filter(Boolean).join(', '),
    dormLabel(row.dorm_id),
    row.room_number ?? '',
    formatDate(row.created_at),
  ])
}

export async function downloadUnregisteredXlsx(
  rows: UnregisteredPermitRow[],
  dormLabel: (dormId: string | null) => string,
) {
  const stamp = new Date().toISOString().slice(0, 10)
  await downloadXlsx({
    filename: `royxatdan-otmaganlar-${stamp}.xlsx`,
    sheetName: "Ro'yxatdan o'tmaganlar",
    headers: UNREGISTERED_EXPORT_HEADERS,
    rows: unregisteredExportRows(rows, dormLabel),
  })
}
