import * as XLSX from 'xlsx'

export type SpreadsheetCell = string | number | boolean | Date | null | undefined
export type SpreadsheetMerge = { s: { r: number; c: number }; e: { r: number; c: number } }

// Spreadsheet programs can execute values beginning with =, +, -, @ or
// control whitespace as formulas. User-controlled exports must force those
// values to text to prevent CSV/XLSX formula injection.
export function sanitizeSpreadsheetCell(value: SpreadsheetCell): SpreadsheetCell {
  if (typeof value !== 'string') return value
  return /^[\s]*[=+\-@\t\r\n]/.test(value) ? `'${value}` : value
}

export function sanitizeSpreadsheetRows(rows: SpreadsheetCell[][]) {
  return rows.map((row) => row.map(sanitizeSpreadsheetCell))
}

export function spreadsheetColumnWidths(headers: string[], rows: SpreadsheetCell[][]) {
  return headers.map((header, index) => {
    const maxLength = Math.max(
      header.length,
      ...rows.map((row) => String(row[index] ?? '').length),
    )
    return { wch: Math.min(index === 0 ? Math.max(maxLength + 2, 5) : maxLength + 4, 60) }
  })
}

export function downloadXlsx(options: {
  filename: string
  sheetName: string
  headers: string[]
  rows: SpreadsheetCell[][]
  merges?: SpreadsheetMerge[]
}) {
  const safeRows = sanitizeSpreadsheetRows([options.headers, ...options.rows])
  const worksheet = XLSX.utils.aoa_to_sheet(safeRows)
  worksheet['!cols'] = spreadsheetColumnWidths(options.headers, options.rows)
  if (options.merges?.length) worksheet['!merges'] = options.merges

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, options.sheetName.slice(0, 31))
  const buffer = XLSX.write(workbook, {
    bookType: 'xlsx',
    type: 'array',
    compression: true,
  })

  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = options.filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
