/**
 * Canonical faculty codes. Every entry point (pre-enrollment permit /
 * yo'llanma form, imtiyozli ariza, dekan registration, admin edit screens,
 * announcement targeting) picks from this one list and stores the `value`.
 *
 * The dekan overview matches `permit_requests.faculty` / `users.faculty`
 * against `staff.faculty` with a case-insensitive string equality check, so
 * any drift here — a free-typed faculty name instead of one of these codes —
 * means a dekan silently never sees the students meant for them.
 *
 * Codes `amit`, `fizika`, `kimyo`, `tarix`, `biologiya` predate the full
 * university list and are kept unchanged, so existing rows need no
 * migration. The 202609010000 migration only normalises free-typed
 * spellings ("AMIT", "Amaliy matematika") onto these codes.
 *
 * Source: nuu.uz/fakultet-va-kafedralar/ and each faculty's nuu.uz page
 * (Bakalavriat section), captured 2026-08-28.
 */
export const PERMIT_FACULTIES = [
  { value: 'matematika', label: 'Matematika' },
  { value: 'amit', label: 'Amaliy matematika va intellektual texnologiyalar' },
  { value: 'fizika', label: 'Fizika' },
  { value: 'kimyo', label: 'Kimyo' },
  { value: 'biologiya', label: 'Biologiya va ekologiya' },
  { value: 'geologiya', label: 'Geologiya va muhandislik geologiyasi' },
  { value: 'geografiya', label: 'Geografiya va geoaxborot tizimlari' },
  { value: 'iqtisodiyot', label: 'Iqtisodiyot' },
  { value: 'tarix', label: 'Tarix' },
  { value: 'ijtimoiy-fanlar', label: 'Ijtimoiy fanlar' },
  { value: 'xorijiy-filologiya', label: 'Xorijiy filologiya' },
  { value: 'ozbek-filologiyasi', label: "Jurnalistika va o‘zbek filologiyasi" },
  { value: 'sport', label: 'Taekvondo va sport faoliyati' },
] as const

export type PermitFacultyValue = (typeof PERMIT_FACULTIES)[number]['value']

export function isPermitFacultyValue(value: string): value is PermitFacultyValue {
  return PERMIT_FACULTIES.some((f) => f.value === value)
}

/**
 * Free-typed / legacy faculty spellings that should resolve to a canonical
 * code. Keyed the same normalised way `facultyKey` compares — lowercase,
 * letters and digits only — so "AMIT", "amit ", "Amaliy matematika" all land
 * on `amit`. The 202609010000 migration applies the identical map in SQL.
 */
const FACULTY_ALIASES: Record<string, PermitFacultyValue> = {
  amit: 'amit',
  amaliymatematikavaintellektualtexnologiyalar: 'amit',
  amaliymatematika: 'amit',
  matematika: 'matematika',
  fizika: 'fizika',
  kimyo: 'kimyo',
  biologiya: 'biologiya',
  biologiyavaekologiya: 'biologiya',
  geologiya: 'geologiya',
  geologiyavamuhandislikgeologiyasi: 'geologiya',
  geografiya: 'geografiya',
  geografiyavageoaxborottizimlari: 'geografiya',
  iqtisodiyot: 'iqtisodiyot',
  tarix: 'tarix',
  ijtimoiyfanlar: 'ijtimoiy-fanlar',
  xorijiyfilologiya: 'xorijiy-filologiya',
  ozbekfilologiyasi: 'ozbek-filologiyasi',
  jurnalistikavaozbekfilologiyasi: 'ozbek-filologiyasi',
  jurnalistika: 'ozbek-filologiyasi',
  sport: 'sport',
  taekvondo: 'sport',
  taekvondovasportfaoliyati: 'sport',
}

function facultyKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/** Canonical code for any known spelling of a faculty, or null. */
export function normalizeFaculty(value: string | null | undefined): PermitFacultyValue | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  if (isPermitFacultyValue(raw)) return raw
  return FACULTY_ALIASES[facultyKey(raw)] ?? null
}

/**
 * Maps a stored faculty code (e.g. "amit") to its display label. Falls back
 * to the raw value for any legacy/unrecognized data so nothing silently
 * disappears from the UI.
 */
export function permitFacultyLabel(value: string | null | undefined): string {
  if (!value) return ''
  const canonical = normalizeFaculty(value)
  const match = PERMIT_FACULTIES.find((f) => f.value === (canonical ?? value.trim().toLowerCase()))
  return match ? match.label : value
}
