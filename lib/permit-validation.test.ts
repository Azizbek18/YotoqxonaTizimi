import { describe, expect, it } from 'vitest'
import {
  PERMIT_FILE_RULES,
  buildFullName,
  detectPermitFileMimeType,
  getNamePartError,
  hasAllowedSignature,
  isPlausibleInternationalPhone,
  isValidEmail,
  isValidForeignIdNumber,
  isValidJoinedFullName,
  isValidJshshir,
  isValidNamePart,
  isValidPassport,
  normalizeJshshir,
  normalizeForeignIdNumber,
  normalizePassport,
} from './permit-validation'

describe('permit validation', () => {
  it('normalizes and validates Uzbek passport identifiers', () => {
    expect(normalizePassport(' aa 1234567 ')).toBe('AA1234567')
    expect(isValidPassport('AA1234567')).toBe(true)
    expect(isValidPassport('AA123456')).toBe(false)
  })

  it('keeps foreign IDs out of the regular Uzbek yo\'llanma validator', () => {
    expect(isValidPassport('A1234567')).toBe(false)
    expect(isValidPassport('A12345678')).toBe(false)
    expect(isValidForeignIdNumber('A1234567')).toBe(true)
    expect(isValidForeignIdNumber('A12345678')).toBe(true)
  })

  it.each([
    ['A1234567', 'A1234567'],
    ['A12345678', 'A12345678'],
    ['ab-123 456', 'AB123456'],
    ['TM01A2345', 'TM01A2345'],
    ['012345678', '012345678'],
  ])('normalizes and accepts varied foreign ID %s', (input, expected) => {
    const normalized = normalizeForeignIdNumber(input)
    expect(normalized).toBe(expected)
    expect(isValidForeignIdNumber(normalized)).toBe(true)
  })

  it.each(['ABCDEF', 'A12', '', 'ABCDEFGHIJKLMNOP1'])('rejects unsafe foreign ID %s', (input) => {
    expect(isValidForeignIdNumber(normalizeForeignIdNumber(input))).toBe(false)
  })

  it('validates email and international phone formats consistently', () => {
    expect(isValidEmail('student.tm@example.com')).toBe(true)
    expect(isValidEmail('student@')).toBe(false)
    expect(isPlausibleInternationalPhone('+993 65 123456')).toBe(true)
    expect(isPlausibleInternationalPhone('+998 (90) 123-45-67')).toBe(true)
    expect(isPlausibleInternationalPhone('abcdefg')).toBe(false)
    expect(isPlausibleInternationalPhone('+12')).toBe(false)
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

  it('detects the canonical MIME type from file bytes', () => {
    expect(detectPermitFileMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(detectPermitFileMimeType(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe('application/pdf')
    expect(detectPermitFileMimeType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull()
  })
})

describe('name parts', () => {
  it('accepts Latin, Cyrillic, the Uzbek apostrophe, hyphens and two-word surnames', () => {
    expect(isValidNamePart('Moʻminov')).toBe(true)
    expect(isValidNamePart("Sa'dulla")).toBe(true)
    expect(isValidNamePart('Абдуллаев')).toBe(true)
    expect(isValidNamePart('Abdulla oʻgʻli')).toBe(true)
    expect(isValidNamePart('Amir-Temur')).toBe(true)
  })

  it('rejects digits, single letters, empty and symbol-only values', () => {
    expect(isValidNamePart('A')).toBe(false)
    expect(isValidNamePart('Ali1')).toBe(false)
    expect(isValidNamePart('  ')).toBe(false)
    expect(isValidNamePart('@#$')).toBe(false)
  })

  it('getNamePartError names the empty and the malformed case', () => {
    expect(getNamePartError('', 'Familiya')).toBe('Familiyani kiriting.')
    expect(getNamePartError('Ali2', 'Ism')).toMatch(/faqat harflardan/)
    expect(getNamePartError('Aliyev', 'Familiya')).toBeNull()
  })

  it('buildFullName joins in Familiya-Ism-Sharif order and drops blanks', () => {
    expect(buildFullName({ lastName: ' Aliyev ', firstName: 'Vali', middleName: 'Anvarovich' }))
      .toBe('Aliyev Vali Anvarovich')
    expect(buildFullName({ lastName: 'Smith', firstName: 'John', middleName: '' })).toBe('Smith John')
  })

  it('buildFullName / isValidNamePart Latinise Cyrillic parts', () => {
    expect(buildFullName({ lastName: 'Иванов', firstName: 'Пётр', middleName: '' })).toBe('Ivanov Petr')
    expect(buildFullName({ lastName: 'Ғафуров', firstName: 'Хусан', middleName: 'Аброрович' }))
      .toBe('Gʻafurov Xusan Abrorovich')
    expect(isValidNamePart('Абдуллаев')).toBe(true)
  })

  it('isValidJoinedFullName enforces the minimum part count', () => {
    expect(isValidJoinedFullName('Aliyev Vali Anvarovich')).toBe(true)
    expect(isValidJoinedFullName('Aliyev Vali')).toBe(false)
    expect(isValidJoinedFullName('Aliyev Vali', 2)).toBe(true)
    expect(isValidJoinedFullName('Aliyev Vali 3vich')).toBe(false)
  })
})
