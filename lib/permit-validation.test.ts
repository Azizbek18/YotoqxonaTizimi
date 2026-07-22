import { describe, expect, it } from 'vitest'
import {
  PERMIT_FILE_RULES,
  hasAllowedSignature,
  isValidJshshir,
  isValidPassport,
  normalizeJshshir,
  normalizePassport,
} from './permit-validation'

describe('permit validation', () => {
  it('normalizes and validates Uzbek passport identifiers', () => {
    expect(normalizePassport(' aa 1234567 ')).toBe('AA1234567')
    expect(isValidPassport('AA1234567')).toBe(true)
    expect(isValidPassport('AA123456')).toBe(false)
  })

  it('keeps exactly fourteen JShShIR digits', () => {
    expect(normalizeJshshir('301-02-03-0405060')).toBe('30102030405060')
    expect(isValidJshshir('30102030405060')).toBe(true)
    expect(isValidJshshir('3010203040506')).toBe(false)
  })

  it('rejects MIME spoofing by checking file signatures', () => {
    expect(hasAllowedSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), PERMIT_FILE_RULES['application/pdf'].signatures)).toBe(true)
    expect(hasAllowedSignature(new Uint8Array([0x3c, 0x73, 0x63, 0x72]), PERMIT_FILE_RULES['application/pdf'].signatures)).toBe(false)
  })
})
