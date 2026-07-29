import { describe, expect, it } from 'vitest'
import { sanitizeSpreadsheetCell, spreadsheetColumnWidths } from './spreadsheet-export'

describe('spreadsheet export hardening', () => {
  it.each([
    '=HYPERLINK("https://attacker.invalid")',
    '+1+1',
    '-2+3',
    '@SUM(A1:A2)',
    '  =cmd',
    '\t=cmd',
    '\r=cmd',
    '\n=cmd',
  ])('forces formula-shaped text to a literal: %s', (value) => {
    expect(sanitizeSpreadsheetCell(value)).toBe(`'${value}`)
  })

  it('does not alter ordinary values or non-string cells', () => {
    expect(sanitizeSpreadsheetCell('Azizbek')).toBe('Azizbek')
    expect(sanitizeSpreadsheetCell(42)).toBe(42)
    expect(sanitizeSpreadsheetCell(null)).toBeNull()
  })

  it('caps attacker-controlled column widths', () => {
    const widths = spreadsheetColumnWidths(['Name'], [['x'.repeat(10_000)]])
    expect(widths).toEqual([{ wch: 60 }])
  })
})
