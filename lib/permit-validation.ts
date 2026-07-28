export const PERMIT_FILE_RULES: Record<string, { extension: string; signatures: number[][] }> = {
  'application/pdf': { extension: 'pdf', signatures: [[0x25, 0x50, 0x44, 0x46]] },
  'image/jpeg': { extension: 'jpg', signatures: [[0xff, 0xd8, 0xff]] },
  'image/png': { extension: 'png', signatures: [[0x89, 0x50, 0x4e, 0x47]] },
  'image/webp': { extension: 'webp', signatures: [[0x52, 0x49, 0x46, 0x46]] },
}

export function normalizePassport(input: unknown) {
  return String(input ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
}

export function normalizeJshshir(input: unknown) {
  return String(input ?? '').replace(/\D/g, '').slice(0, 14)
}

export function isValidPassport(value: string) {
  return /^[A-Z]{2}\d{7}$/.test(value)
}

export function isValidJshshir(value: string) {
  return /^\d{14}$/.test(value)
}

export function hasAllowedSignature(buffer: Uint8Array, signatures: number[][]) {
  return signatures.some((signature) => signature.every((byte, index) => buffer[index] === byte))
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
