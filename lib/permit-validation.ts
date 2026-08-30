export const PERMIT_FILE_RULES: Record<string, { extension: string; signatures: number[][] }> = {
  'application/pdf': { extension: 'pdf', signatures: [[0x25, 0x50, 0x44, 0x46]] },
  'image/jpeg': { extension: 'jpg', signatures: [[0xff, 0xd8, 0xff]] },
  'image/png': { extension: 'png', signatures: [[0x89, 0x50, 0x4e, 0x47]] },
  'image/webp': { extension: 'webp', signatures: [[0x52, 0x49, 0x46, 0x46]] },
}

export type PermitFileMimeType = keyof typeof PERMIT_FILE_RULES

export function normalizeForeignIdNumber(input: unknown) {
  return String(input ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
}

export function normalizePassport(input: unknown) {
  return normalizeForeignIdNumber(input)
}

export function normalizeJshshir(input: unknown) {
  return String(input ?? '').replace(/\D/g, '').slice(0, 14)
}

export function isValidPassport(value: string) {
  // Uzbekistan: AA1234567. Turkmenistan/foreign students commonly use
  // A1234567 (and some current documents carry one extra serial digit).
  return /^(?:[A-Z]{2}\d{7}|[A-Z]\d{7,8})$/.test(value)
}

export function isValidForeignIdNumber(value: string) {
  // Foreign documents vary by country. Keep this deliberately broader than
  // the Uzbek passport rule, but reject letter-only values and punctuation.
  return /^(?=.*\d)[A-Z0-9]{4,16}$/.test(value)
}

export function getForeignIdFormatError(input: unknown): string | null {
  const value = normalizeForeignIdNumber(input)
  if (!value || isValidForeignIdNumber(value)) return null
  return "Pasport/ID raqami 4–16 ta lotin harfi va raqamdan iborat bo'lishi, kamida bitta raqam qatnashishi kerak."
}

export function isValidEmail(input: unknown) {
  const value = String(input ?? '').trim().toLowerCase()
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function isPlausibleInternationalPhone(input: unknown) {
  const value = String(input ?? '').trim()
  if (!/^\+?[\d\s()-]+$/.test(value)) return false
  const digits = value.replace(/\D/g, '')
  return digits.length >= 7 && digits.length <= 15
}

export function getPassportFormatError(input: unknown): string | null {
  const value = normalizePassport(input)
  if (!value || isValidPassport(value)) return null
  return "Format noto'g'ri. O'zbekiston: AA1234567; xorijiy pasport: A1234567 yoki A12345678."
}

export function isValidJshshir(value: string) {
  return /^\d{14}$/.test(value)
}

export function hasAllowedSignature(buffer: Uint8Array, signatures: number[][]) {
  return signatures.some((signature) => signature.every((byte, index) => buffer[index] === byte))
}

/**
 * Detect the actual file type from bytes instead of trusting File.type.
 * Mobile/in-app browsers frequently send a valid JPEG/PDF as an empty,
 * generic, or incorrect MIME type. The signature remains authoritative.
 */
export function detectPermitFileMimeType(buffer: Uint8Array): PermitFileMimeType | null {
  for (const [mimeType, rule] of Object.entries(PERMIT_FILE_RULES)) {
    if (!hasAllowedSignature(buffer, rule.signatures)) continue
    if (
      mimeType === 'image/webp'
      && String.fromCharCode(...buffer.slice(8, 12)) !== 'WEBP'
    ) continue
    return mimeType
  }
  return null
}

function normalizeNameToken(s: string): string {
  return s.toUpperCase().replace(/[ʻʼ'`´]/g, '').replace(/[^A-ZА-Я]/g, '')
}

export function canonicalizeFullName(input: unknown): string {
  return String(input ?? '').trim().slice(0, 160)
}

// Lenient match: the compared full name may omit/reorder parts (e.g. a
// document's formal "O'G'LI/QIZI" suffix), so we require most of one name's
// tokens to have an exact counterpart among the other name's tokens, rather
// than requiring every token in the same order. This must NOT be substring
// containment ("ALI".includes-style) — that would match "Ali Karim" against
// "Vali Karim" too, since "ALI" is a substring of "VALI".
export function namesLikelyMatch(declared: string, other: string): boolean {
  // De-duplicated — otherwise a declared name repeating a token (e.g. "Ali
  // Ali") would count that single shared token twice, inflating the match
  // ratio against a name that only actually shares one real token with it.
  const declaredTokens = Array.from(new Set(declared.split(/\s+/).map(normalizeNameToken).filter((t) => t.length >= 2)))
  if (declaredTokens.length === 0) return false
  const otherTokens = new Set(other.split(/\s+/).map(normalizeNameToken).filter((t) => t.length >= 2))
  if (otherTokens.size === 0) return false

  const matches = declaredTokens.filter((t) => otherTokens.has(t))
  const requiredMatches = declaredTokens.length <= 2 ? declaredTokens.length : Math.ceil(declaredTokens.length * 0.7)
  return matches.length >= requiredMatches
}
