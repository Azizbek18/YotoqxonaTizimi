import { cyrillicToLatin } from './transliterate'

export const PERMIT_FILE_RULES: Record<string, { extension: string; signatures: number[][] }> = {
  'application/pdf': { extension: 'pdf', signatures: [[0x25, 0x50, 0x44, 0x46]] },
  'image/jpeg': { extension: 'jpg', signatures: [[0xff, 0xd8, 0xff]] },
  'image/png': { extension: 'png', signatures: [[0x89, 0x50, 0x4e, 0x47]] },
  'image/webp': { extension: 'webp', signatures: [[0x52, 0x49, 0x46, 0x46]] },
}

export type PermitFileMimeType = keyof typeof PERMIT_FILE_RULES

// The applicant's home region, picked from a dropdown in the yo'llanma flow
// (an Uzbek citizen always comes from one of these) so the generated
// Ariza/Tilxat reads "<region> viloyatidan kelganligim" with a canonical
// value. Foreign / imtiyozli applicants type theirs free-form instead.
export const UZ_ORIGIN_REGIONS = [
  'Andijon',
  'Buxoro',
  "Farg'ona",
  'Jizzax',
  'Namangan',
  'Navoiy',
  'Qashqadaryo',
  "Qoraqalpog'iston Respublikasi",
  'Samarqand',
  'Sirdaryo',
  'Surxondaryo',
  'Toshkent shahri',
  'Toshkent viloyati',
  'Xorazm',
] as const

export function isValidUzOriginRegion(input: unknown): boolean {
  return (UZ_ORIGIN_REGIONS as readonly string[]).includes(String(input ?? '').trim())
}

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
  // The regular yo'llanma flow is only for Uzbekistan passports.
  // Foreign documents use isValidForeignIdNumber in the imtiyozli flow.
  return /^[A-Z]{2}\d{7}$/.test(value)
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
  return "Format noto'g'ri. O'zbekiston pasporti: AA1234567. Xorijiy talaba bo'lsangiz, xorijiy/imtiyozli ariza turini tanlang."
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
  // Latinise first so a Cyrillic-era record still matches a Latin one.
  return cyrillicToLatin(s).toUpperCase().replace(/[ʻʼ'`´]/g, '').replace(/[^A-ZА-Я]/g, '')
}

// "son/daughter of" markers — they carry no identity, and the my.gov.uz
// referral, the passport and the typed form disagree about whether to
// include one at all. Dropped from both sides before matching.
const PATRONYMIC_MARKERS = new Set([
  'OGLI', 'UGLI', 'UGHLI', 'OGIL', 'QIZI', 'KIZI', 'QIZ', 'QYZY', 'UILI', 'ULI', 'ULY', 'UULU',
])

// True when one token is the other plus a short trailing bit — a patronymic
// suffix (BAXTIYAR ↔ BAXTIYAROVICH, ABDULLA ↔ ABDULLAYEV) or a diminutive
// tail (ISLOM ↔ ISLOMBEK). The shared root must be long enough that this
// can't fuse two genuinely different names (RUSTAM vs SHERZOD).
function patronymicRootMatches(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a]
  if (short.length < 5 || short === long) return false
  return long.startsWith(short) && long.length - short.length <= 6
}

function nameTokenLikelyMatches(left: string, right: string): boolean {
  if (left === right) return true
  // OCR commonly drops or changes one character in a long name. Allow a
  // single edit only for tokens long enough to make this safe; short names
  // remain exact-match only so ALI cannot match Vali.
  if (left.length < 5 || right.length < 5) return false
  if (Math.abs(left.length - right.length) > 1) return false
  const row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = row[0]
    row[0] = i
    let rowMinimum = row[0]
    for (let j = 1; j <= right.length; j += 1) {
      const above = row[j]
      row[j] = left[i - 1] === right[j - 1]
        ? diagonal
        : Math.min(diagonal, above, row[j - 1]) + 1
      diagonal = above
      rowMinimum = Math.min(rowMinimum, row[j])
    }
    if (rowMinimum > 1) return false
  }
  return row[right.length] <= 1
}

// Mobile keyboards, IMEs and copy/paste from government PDFs slip exotic
// spacing into a name: non-breaking / narrow / figure spaces (all matched by
// \s), plus zero-width space/joiners and the word-joiner / BOM (which \s does
// NOT match). A zero-width character between two words makes the validator
// read "Familiya<ZWSP>Ism Sharif" as two parts, not three, and it survives
// into the stored name — where namesLikelyMatch then fuses the glued tokens
// and the generated Ariza/Tilxat PDF renders invisible gaps. Fold every one
// of them to a single normal space. Not trimmed, so it is safe to run on
// every keystroke of a name field (a trailing space is still being typed).
const NAME_WHITESPACE_RE = /[\s\u200B\u200C\u200D\u2060\uFEFF]+/gu

export function normalizeNameWhitespace(input: unknown): string {
  return String(input ?? '').replace(NAME_WHITESPACE_RE, ' ')
}

export function canonicalizeFullName(input: unknown): string {
  return normalizeNameWhitespace(input).trim().slice(0, 160)
}

// One part of a name (familiya / ism / sharif). Latin letters only — a
// Cyrillic name is transliterated first (see normalizeNamePart), so the
// dekan tables and exports carry one spelling. Uzbek apostrophe, hyphen,
// internal spaces (two-word surnames). 2–40 chars, starts with a letter.
const NAME_PART_RE = /^\p{L}[\p{L}ʻʼ'’\- ]{1,39}$/u

// Trim, collapse spaces, and Latinise any Cyrillic. Use this on every name
// input (client onChange + server) so what gets validated/stored is Latin.
export function normalizeNamePart(input: unknown): string {
  return cyrillicToLatin(normalizeNameWhitespace(input).trim())
}

export function isValidNamePart(input: unknown): boolean {
  return NAME_PART_RE.test(normalizeNamePart(input))
}

export function getNamePartError(input: unknown, label: string): string | null {
  const value = normalizeNamePart(input)
  if (!value) return `${label}ni kiriting.`
  if (!isValidNamePart(value)) return `${label} faqat harflardan iborat, 2–40 belgi bo'lishi kerak.`
  return null
}

// The canonical full name, always "Familiya Ism Sharif" (the same order
// app/api/student/register builds). Transliterated as ONE string so the
// Uzbek-vs-Russian rule is chosen from the whole name, not a lone part
// ("Ғафуров Хусан" → "Gʻafurov Xusan", not "Gʻafurov Khusan").
export function buildFullName(parts: {
  lastName?: unknown
  firstName?: unknown
  middleName?: unknown
}): string {
  const joined = [parts.lastName, parts.firstName, parts.middleName]
    .map((part) => normalizeNameWhitespace(part).trim())
    .filter(Boolean)
    .join(' ')
  return cyrillicToLatin(joined).slice(0, 160)
}

// Server-side guard for a joined name string: at least `minParts`
// whitespace-separated tokens, every one a valid (Latinised) name part.
export function isValidJoinedFullName(input: unknown, minParts = 3): boolean {
  // Fold the exotic spacing a phone keyboard or a copied government PDF
  // leaves between the F.I.Sh parts (see normalizeNameWhitespace) before
  // counting them, otherwise "Familiya<ZWSP>Ism Sharif" reads as 2 parts.
  const normalized = canonicalizeFullName(cyrillicToLatin(String(input ?? '')))
  const parts = normalized.split(' ').filter(Boolean)
  return parts.length >= minParts && parts.every(isValidNamePart)
}

// Lenient match: the compared full name may omit/reorder parts (e.g. a
// document's formal "O'G'LI/QIZI" suffix), so we require most of one name's
// tokens to have an exact counterpart among the other name's tokens, rather
// than requiring every token in the same order. This must NOT be substring
// containment ("ALI".includes-style) — that would match "Ali Karim" against
// "Vali Karim" too, since "ALI" is a substring of "VALI".
export function namesLikelyMatch(declared: string, other: string): boolean {
  const tokenize = (name: string) =>
    // Latinise the WHOLE name first: the Uzbek-vs-Russian transliteration
    // rule is chosen from surrounding context, so a lone Cyrillic token
    // ("Хусан") turns into "Khusan" but the same token inside "Ғафуров
    // Хусан" correctly becomes "Xusan". Tokenising before transliterating
    // would make the two spellings of one name fail to match.
    cyrillicToLatin(normalizeNameWhitespace(name)).split(/\s+/)
      .map(normalizeNameToken)
      .filter((t) => t.length >= 2 && !PATRONYMIC_MARKERS.has(t))

  // De-duplicated — otherwise a declared name repeating a token (e.g. "Ali
  // Ali") would count that single shared token twice, inflating the match
  // ratio against a name that only actually shares one real token with it.
  const declaredTokens = Array.from(new Set(tokenize(declared)))
  if (declaredTokens.length === 0) return false
  const otherTokens = Array.from(new Set(tokenize(other)))
  if (otherTokens.length === 0) return false

  // `declared` is always our own canonical "Familiya Ism [Sharif]" string
  // (see buildFullName / canonicalizeFullName), so its first two tokens are
  // the family name and the given name — the identity anchors. Both MUST
  // line up, by an exact or single-OCR-edit match only: a shared root
  // (BAXTIYAR↔BAXTIYAROVICH, ISLOM↔ISLOMBEK) is NOT enough for an anchor,
  // otherwise a sibling's referral (same surname + patronymic, different
  // given name) would pass.
  const anchorCount = Math.min(2, declaredTokens.length)
  for (let i = 0; i < anchorCount; i += 1) {
    if (!otherTokens.some((candidate) => nameTokenLikelyMatches(declaredTokens[i], candidate))) {
      return false
    }
  }
  const n = declaredTokens.length
  if (n <= 3) {
    // The 3rd part (patronymic) is written inconsistently across the
    // referral, the passport and the form — "Baxtiyarovich" vs "Baxtiyar
    // o'g'li" vs omitted — and JShSHIR + passport are matched exactly by the
    // caller, so with both anchors confirmed the patronymic is optional.
    return true
  }
  // 4+ tokens (double surname / double given name): require ~70% overall,
  // allowing a shared-root match for the non-anchor parts.
  const extraMatches = declaredTokens.slice(2).filter((t) =>
    otherTokens.some((candidate) =>
      nameTokenLikelyMatches(t, candidate) || patronymicRootMatches(t, candidate),
    ),
  ).length
  return anchorCount + extraMatches >= Math.ceil(n * 0.7)
}
