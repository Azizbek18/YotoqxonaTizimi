import { describe, expect, it } from 'vitest'
import { evaluatePermitDocument, type PermitDocumentAiResult } from './permit-document-ai'

const declared = {
  fullName: "MO'MINOV AZIZBEK ULUG'BEK O'G'LI",
  jshshir: '51804055310015',
  passport: 'AD0970061',
}

const officialReferral: PermitDocumentAiResult = {
  document_type: 'dormitory_referral',
  matches_reference_layout: true,
  has_mygov_header: true,
  has_ministry_header: true,
  has_bilingual_title: true,
  has_student_identity_section: true,
  has_qr_code: true,
  document_confidence: 94,
  extracted_full_name: declared.fullName,
  extracted_jshshir: declared.jshshir,
  extracted_passport: declared.passport,
}

describe('permit document AI evaluation', () => {
  it('accepts a full official-layout referral whose identity matches', () => {
    const evaluated = evaluatePermitDocument(officialReferral, declared)

    expect(evaluated.valid).toBe(true)
    expect(evaluated.mismatches).toEqual([])
  })

  it('rejects an unrelated image even if the AI extracted matching text', () => {
    const evaluated = evaluatePermitDocument({
      ...officialReferral,
      document_type: 'profile_photo',
      matches_reference_layout: false,
      has_bilingual_title: false,
      has_qr_code: false,
    }, declared)

    expect(evaluated.valid).toBe(false)
    expect(evaluated.mismatches[0]).toContain('rasmiy my.gov.uz yo‘llanmasiga')
  })

  it('rejects loose string booleans instead of treating them as true', () => {
    const evaluated = evaluatePermitDocument({
      ...officialReferral,
      matches_reference_layout: 'true',
      has_qr_code: 'true',
    }, declared)

    expect(evaluated.valid).toBe(false)
  })

  it('allows changing dormitory wording but rejects a different student identity', () => {
    const evaluated = evaluatePermitDocument({
      ...officialReferral,
      extracted_dormitory_name: '3-sonli talabalar turar joyi',
      extracted_dormitory_address: 'Boshqa rasmiy manzil',
      extracted_passport: 'AA1234567',
    }, declared)

    expect(evaluated.valid).toBe(false)
    expect(evaluated.mismatches).toContain(
      'Hujjatdagi pasport seriya/raqami aniqlanmadi yoki formada kiritilgan ma’lumot bilan mos kelmadi.',
    )
    expect(evaluated.mismatches).toHaveLength(1)
  })

  it('allows a one-character OCR error in a long name token', () => {
    const evaluated = evaluatePermitDocument({
      ...officialReferral,
      extracted_full_name: "MO'MINOV AZIZBE ULUG'BEK O'G'LI",
    }, declared)

    expect(evaluated.valid).toBe(true)
  })

  it('does not turn short similar names into a match', () => {
    const evaluated = evaluatePermitDocument({
      ...officialReferral,
      extracted_full_name: 'VALI',
    }, { ...declared, fullName: 'ALI' })

    expect(evaluated.mismatches).toContain(
      'Hujjatdagi F.I.Sh aniqlanmadi yoki formada kiritilgan ism-familiya bilan mos kelmadi.',
    )
  })
})
