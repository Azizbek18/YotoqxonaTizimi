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

// Country dial codes offered in <PhoneField>. O'zbekiston is the default; the
// rest cover the actual foreign-student population (Turkmen, Tajik, Kazakh,
// Kyrgyz…). "Boshqa" (empty code) lets the applicant type any code by hand.
export const PHONE_DIAL_CODES = [
  { code: '+998', label: "O'zbekiston" },
  { code: '+993', label: 'Turkmaniston' },
  { code: '+992', label: 'Tojikiston' },
  { code: '+7', label: "Qozog'iston / Rossiya" },
  { code: '+996', label: "Qirg'iziston" },
  { code: '+93', label: "Afg'oniston" },
  { code: '+994', label: 'Ozarbayjon' },
] as const

export const DEFAULT_DIAL_CODE = '+998'

// Canonical E.164-ish store form: a leading "+" then digits only, no spaces or
// punctuation. Empty input stays empty. Caps the length so a paste bomb can't
// bloat the column.
export function normalizePhoneE164(input: unknown): string {
  const digits = String(input ?? '').replace(/\D/g, '').slice(0, 15)
  return digits ? `+${digits}` : ''
}

// Split a stored phone into { dialCode, national } for <PhoneField>. Matches the
// longest known dial code; an unrecognised "+" number keeps its first 1–4
// digits as the code so the field still round-trips. A bare (legacy 9-digit)
// number is treated as O'zbekiston.
export function splitPhone(input: unknown): { dialCode: string; national: string } {
  const raw = String(input ?? '').trim()
  const digits = raw.replace(/\D/g, '')
  if (!digits) return { dialCode: DEFAULT_DIAL_CODE, national: '' }
  if (!raw.startsWith('+')) return { dialCode: DEFAULT_DIAL_CODE, national: digits }
  const known = [...PHONE_DIAL_CODES]
    .map((c) => c.code.slice(1))
    .sort((a, b) => b.length - a.length)
    .find((c) => digits.startsWith(c))
  const codeDigits = known ?? digits.slice(0, Math.min(4, Math.max(1, digits.length - 6)))
  return { dialCode: `+${codeDigits}`, national: digits.slice(codeDigits.length) }
}

// Human-readable phone for documents / tables. Groups the national part in
// small chunks. A legacy bare number is shown as an O'zbekiston number so old
// rows still read correctly.
export function formatPhoneForDisplay(input: unknown): string {
  const raw = String(input ?? '').trim()
  if (!raw) return ''
  const { dialCode, national } = raw.startsWith('+')
    ? splitPhone(raw)
    : { dialCode: DEFAULT_DIAL_CODE, national: raw.replace(/\D/g, '') }
  if (!national) return dialCode
  const grouped = national.replace(/(\d{3})(?=\d)/g, '$1 ')
  return `${dialCode} ${grouped}`
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
  'OGLI', 'UGLI', 'UGHLI', 'OGIL', 'QIZI', 'KIZI', 'QIZ', 'QYZY', 'GYZY', 'GIZI',
  'UILI', 'ULI', 'ULY', 'UULU',
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

// The single F.I.Sh string the yo'llanma AI precheck (/api/ai/yollanma-tekshiruv)
// signs into its file claim and /api/permit-requests verifies it against.
// BOTH routes must derive it from the raw `fullName` field the *exact* same
// way — the claim context is compared as an opaque string, so any divergence
// (the submission route title-cases + Latinises + strips placeholders while
// the precheck did not) silently turns a genuine AI-approved upload into
// "Hujjat avval AI orqali tekshirilishi shart". Uppercased so a name typed
// in CAPS on one request and Title Case on the other still matches.
export function permitClaimFullName(input: unknown): string {
  return canonicalizeFullName(cyrillicToLatin(stripPlaceholderNameTokens(input))).toUpperCase()
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

// ── Imtiyozli (foreign) applicant name repair ──────────────────────────────
// A foreign applicant types their own F.I.Sh — there is no my.gov.uz referral
// to trust. An early version of the imtiyozli form had a single free-text
// field, and an applicant with no patronymic often types a placeholder instead
// of ticking "no patronymic". So a stored `full_name` is frequently glued into
// one token ("ZairovaGulnaza"), screamed in capitals ("VEPAYEVA ENESH"), or
// padded with "XXX". These helpers let the register wizard pre-split such a
// name for the student to confirm, and let the server accept the correction.

// "XXX" / "xxx" / "XXXX" / "---" / "..." / "yo'q" / "yoq" — carries no identity.
const PLACEHOLDER_NAME_TOKEN_RE = /^(?:x{2,}|-+|\.+|_+|yo['ʻʼ`]?q|yoq|yuq|нет)$/iu

export function stripPlaceholderNameTokens(input: unknown): string {
  return normalizeNameWhitespace(input)
    .trim()
    .split(' ')
    .filter((token) => token && !PLACEHOLDER_NAME_TOKEN_RE.test(token))
    .join(' ')
}

// "ZairovaGulnaza" -> "Zairova Gulnaza". Splits on a lower->upper boundary
// only, so an all-caps glued token ("BABAYEVAGULZIRE") is left as-is — there
// is no reliable boundary and the student fixes that one in the wizard.
export function splitGluedName(input: unknown): string {
  return String(input ?? '').replace(/(\p{Ll})(\p{Lu})/gu, '$1 $2')
}

// "VEPAYEVA ENESH" / "vepayeva enesh" -> "Vepayeva Enesh". Only re-cases a
// token that is wholly upper- or wholly lower-case, so a deliberately mixed
// name ("Go'zal", "McLeod") is left alone. A patronymic marker stays lower
// case ("Olimov Umidjon Doniyor o'g'li", "Rejepova Aygozel Rejep qizi").
export function toTitleCaseName(input: unknown): string {
  return normalizeNameWhitespace(input)
    .trim()
    .split(' ')
    .map((token) => {
      if (!token) return token
      if (PATRONYMIC_MARKERS.has(normalizeNameToken(token))) return token.toLowerCase()
      const uniformCase = token === token.toUpperCase() || token === token.toLowerCase()
      if (!uniformCase) return token
      const lower = token.toLowerCase()
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

// The student's typed F.I.Sh vs the (possibly malformed) permit name. The real
// identity anchor is passport + email + an `approved` permit row — this only
// stops a wholly different name. Accepts a normal lenient match OR a
// spacing/case/placeholder-only difference ("Babayeva Gulzire" <-> "BABAYEVAGULZIRE"
// <-> "Babayeva Gulzire XXX"), in either surname/given order.
export function foreignNameReconciles(declared: string, permitName: string): boolean {
  if (namesLikelyMatch(declared, permitName)) return true
  const squash = (value: string) =>
    cyrillicToLatin(normalizeNameWhitespace(value)).toUpperCase().replace(/[^A-Z]/g, '')
  const d = squash(declared)
  const p = squash(stripPlaceholderNameTokens(permitName))
  if (d.length < 4 || p.length < 4) return false
  if (d === p) return true
  const tokens = cyrillicToLatin(normalizeNameWhitespace(declared)).trim().split(/\s+/)
  if (tokens.length >= 2) {
    const swapped = squash([tokens[1], tokens[0], ...tokens.slice(2)].join(' '))
    if (swapped === p) return true
  }
  return false
}
