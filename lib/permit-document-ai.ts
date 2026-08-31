import {
  namesLikelyMatch,
  normalizeJshshir,
  normalizePassport,
} from './permit-validation'

export type PermitDocumentAiResult = {
  document_type?: unknown
  matches_reference_layout?: unknown
  has_mygov_header?: unknown
  has_ministry_header?: unknown
  has_bilingual_title?: unknown
  has_student_identity_section?: unknown
  has_qr_code?: unknown
  document_confidence?: unknown
  extracted_full_name?: unknown
  extracted_jshshir?: unknown
  extracted_passport?: unknown
  extracted_dormitory_name?: unknown
  extracted_dormitory_address?: unknown
  analysis?: unknown
}

export type EvaluatedPermitDocument = {
  valid: boolean
  confidence: number
  mismatches: string[]
  extracted: {
    fullName: string
    jshshir: string
    passport: string
    dormitoryName: string
    dormitoryAddress: string
  }
  analysis: string
  structure: {
    documentType: string
    matchesReferenceLayout: boolean
    hasMygovHeader: boolean
    hasMinistryHeader: boolean
    hasBilingualTitle: boolean
    hasStudentIdentitySection: boolean
    hasQrCode: boolean
  }
}

const text = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0

export function evaluatePermitDocument(
  result: PermitDocumentAiResult,
  declared: { fullName: string; jshshir: string; passport: string },
): EvaluatedPermitDocument {
  const documentType = text(result.document_type).toLowerCase()
  const confidence = Math.max(0, Math.min(100, number(result.document_confidence)))
  const matchesReferenceLayout = result.matches_reference_layout === true
  const hasMygovHeader = result.has_mygov_header === true
  const hasMinistryHeader = result.has_ministry_header === true
  const hasBilingualTitle = result.has_bilingual_title === true
  const hasStudentIdentitySection = result.has_student_identity_section === true
  const hasQrCode = result.has_qr_code === true
  const extractedFullName = text(result.extracted_full_name)
  const extractedJshshir = text(result.extracted_jshshir)
  const extractedPassport = text(result.extracted_passport)
  const mismatches: string[] = []

  // These anchors describe the stable layout of the official my.gov.uz
  // referral. Student data and wording may vary, so they are deliberately
  // not part of this structural gate.
  if (
    documentType !== 'dormitory_referral'
    || !matchesReferenceLayout
    || (!hasMygovHeader && !hasMinistryHeader)
    || !hasBilingualTitle
    || !hasStudentIdentitySection
    || !hasQrCode
    || confidence < 60
  ) {
    mismatches.push(
      "Yuklangan fayl rasmiy my.gov.uz yo‘llanmasiga o‘xshamaydi. Hujjatning to‘liq sahifasi, “YO‘LLANMA / НАПРАВЛЕНИЕ” sarlavhasi, talaba ma’lumotlari va QR kodi aniq ko‘rinsin.",
    )
  }

  if (!extractedJshshir || normalizeJshshir(extractedJshshir) !== normalizeJshshir(declared.jshshir)) {
    mismatches.push('Hujjatdagi JSHSHIR aniqlanmadi yoki formada kiritilgan JSHSHIR bilan mos kelmadi.')
  }

  if (!extractedPassport || normalizePassport(extractedPassport) !== normalizePassport(declared.passport)) {
    mismatches.push('Hujjatdagi pasport seriya/raqami aniqlanmadi yoki formada kiritilgan ma’lumot bilan mos kelmadi.')
  }

  if (!extractedFullName || !namesLikelyMatch(declared.fullName, extractedFullName)) {
    mismatches.push('Hujjatdagi F.I.Sh aniqlanmadi yoki formada kiritilgan ism-familiya bilan mos kelmadi.')
  }

  return {
    valid: mismatches.length === 0,
    confidence,
    mismatches,
    extracted: {
      fullName: extractedFullName,
      jshshir: extractedJshshir,
      passport: extractedPassport,
      dormitoryName: text(result.extracted_dormitory_name),
      dormitoryAddress: text(result.extracted_dormitory_address),
    },
    analysis: text(result.analysis),
    structure: {
      documentType,
      matchesReferenceLayout,
      hasMygovHeader,
      hasMinistryHeader,
      hasBilingualTitle,
      hasStudentIdentitySection,
      hasQrCode,
    },
  }
}
