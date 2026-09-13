import ExcelJS from 'exceljs'

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

// Bitta o'zgarmas ko'rinish — sarlavha ham, ma'lumot qatorlari ham: matn
// har doim katakning o'rtasida, har bir katakda ingichka ramka. Sarlavha
// bundan tashqari qalin (bold) bo'ladi. Barcha eksportlar (dekan hisobot,
// arizalar, viza nazorati ...) shu bitta funksiya orqali chiqqani uchun
// hammasi bir xil ko'rinishda bo'ladi.
const REPORT_FONT_NAME = 'Times New Roman'
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
}
const CENTERED: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true }

export async function downloadXlsx(options: {
  filename: string
  sheetName: string
  headers: string[]
  rows: SpreadsheetCell[][]
  merges?: SpreadsheetMerge[]
}) {
  const safeRows = sanitizeSpreadsheetRows([options.headers, ...options.rows])

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(options.sheetName.slice(0, 31))
  safeRows.forEach((row) => worksheet.addRow(row))
  worksheet.columns = spreadsheetColumnWidths(options.headers, options.rows).map(({ wch }) => ({ width: wch }))

  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: REPORT_FONT_NAME, size: 12, bold: rowNumber === 1 }
      cell.alignment = CENTERED
      cell.border = THIN_BORDER
    })
  })
  worksheet.getRow(1).height = 32

  // `merges` katakchalari asosiy (aoa) massiv indekslariga qarab hisoblangan
  // (0-index, 0-qator — sarlavha); ExcelJS esa 1-index bilan ishlaydi.
  if (options.merges?.length) {
    for (const merge of options.merges) {
      worksheet.mergeCells(merge.s.r + 1, merge.s.c + 1, merge.e.r + 1, merge.e.c + 1)
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
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
