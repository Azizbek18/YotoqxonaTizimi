import { PERMIT_FACULTIES, type PermitFacultyValue } from '@/lib/faculties'

/**
 * Canonical study directions (yo'nalish).
 *
 * `direction` used to be a free-text field on the permit form while the
 * registration form offered a slug-valued select, so the same direction ended
 * up stored two ways — "amaliy-matematika" from one screen and "Amaliy
 * matematika" from the other — and every grouping, filter and export treated
 * them as two different directions. Every entry point now picks from this one
 * list and stores the `value`; `directionLabel` turns it back into readable
 * text for display, and `normalizeDirection` maps the legacy free-typed
 * spellings onto the same canonical value.
 *
 * Keyed by the canonical faculty codes in lib/faculties.ts — the ones the
 * permit flow and dekan scoping already use — so a faculty has exactly one
 * vocabulary of directions everywhere.
 */

export type DirectionOption = { value: string; label: string }

export const FACULTY_DIRECTIONS: Record<PermitFacultyValue, readonly DirectionOption[]> = {
  amit: [
    { value: 'amaliy-matematika', label: 'Amaliy matematika' },
    { value: 'matematik-tahlil', label: 'Matematik tahlil' },
    { value: 'funksional-tahlil', label: 'Funksional tahlil' },
    { value: 'differensial-tenglamalar', label: 'Differensial tenglamalar' },
    { value: 'dasturiy-injiniring', label: 'Dasturiy injiniring' },
    { value: 'kompyuter-ilmlari', label: 'Kompyuter ilmlari' },
    { value: 'kompyuter-tarmoqlari', label: 'Kompyuter tarmoqlari' },
    { value: 'suniy-intellekt', label: 'Sun’iy intellekt' },
    { value: 'axborot-xavfsizligi', label: 'Axborot xavfsizligi' },
    { value: 'kiberxavfsizlik', label: 'Kiberxavfsizlik' },
    { value: 'raqamli-forensika', label: 'Raqamli forensika' },
  ],
  tarix: [
    { value: 'uzbekiston-tarixi', label: 'O‘zbekiston tarixi' },
    { value: 'jahon-tarixi', label: 'Jahon tarixi' },
    { value: 'arxeologiya', label: 'Arxeologiya' },
  ],
  fizika: [
    { value: 'nazariy-fizika', label: 'Nazariy fizika' },
    { value: 'atom-fizikasi', label: 'Atom va molekulyar fizika' },
    { value: 'energetika', label: 'Energetika' },
  ],
  kimyo: [
    { value: 'organik-kimyo', label: 'Organik kimyo' },
    { value: 'analitik-kimyo', label: 'Analitik kimyo' },
    { value: 'noorganik-kimyo', label: 'Noorganik kimyo' },
  ],
  biologiya: [
    { value: 'genetika', label: 'Genetika' },
    { value: 'mikrobiologiya', label: 'Mikrobiologiya' },
    { value: 'biotexnologiya', label: 'Biotexnologiya' },
  ],
}

/**
 * Directions that older registration screens offered for faculties which are
 * not part of the permit flow. They are never offered for selection, but they
 * stay recognised so a record created back then still normalises and displays
 * as readable text instead of a bare slug.
 */
const LEGACY_DIRECTIONS: readonly DirectionOption[] = [
  { value: 'geologiya-umumiy', label: 'Umumiy geologiya' },
  { value: 'kon-geologiyasi', label: 'Kon geologiyasi' },
  { value: 'gidrogeologiya', label: 'Gidrogeologiya' },
  { value: 'geoekologiya', label: 'Geoekologiya' },
  { value: 'geoinformatika', label: 'Geoinformatika' },
  { value: 'turizm', label: 'Turizm' },
  { value: 'sotsiologiya', label: 'Sotsiologiya' },
  { value: 'psixologiya', label: 'Psixologiya' },
  { value: 'falsafa', label: 'Falsafa' },
  { value: 'fuqarolik-huquqi', label: 'Fuqarolik huquqi' },
  { value: 'jinoyat-huquqi', label: 'Jinoyat huquqi' },
  { value: 'xalqaro-huquq', label: 'Xalqaro huquq' },
  { value: 'iqtisodiyot', label: 'Iqtisodiyot' },
  { value: 'moliya', label: 'Moliya' },
  { value: 'menejment', label: 'Menejment' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'ozbek-filologiyasi', label: 'O‘zbek filologiyasi' },
  { value: 'ozbek-tilshunosligi', label: 'O‘zbek tilshunosligi' },
  { value: 'adabiyotshunoslik', label: 'Adabiyotshunoslik' },
  { value: 'ingliz-filologiyasi', label: 'Ingliz filologiyasi' },
  { value: 'nemis-filologiyasi', label: 'Nemis filologiyasi' },
  { value: 'fransuz-filologiyasi', label: 'Fransuz filologiyasi' },
  { value: 'televideniye', label: 'Televideniye' },
  { value: 'radio', label: 'Radio jurnalistikasi' },
  { value: 'multimedia', label: 'Multimedia jurnalistikasi' },
  { value: 'arabshunoslik', label: 'Arabshunoslik' },
  { value: 'xitoyshunoslik', label: 'Xitoyshunoslik' },
  { value: 'turkshunoslik', label: 'Turkshunoslik' },
]

/** Every selectable direction, de-duplicated (some are shared by faculties). */
export const ALL_DIRECTIONS: readonly DirectionOption[] = (() => {
  const seen = new Map<string, DirectionOption>()
  for (const option of Object.values(FACULTY_DIRECTIONS).flat()) {
    if (!seen.has(option.value)) seen.set(option.value, option)
  }
  return [...seen.values()]
})()

/**
 * Comparison key: everything that isn't a letter or a digit is dropped, so
 * "amaliy-matematika", "Amaliy matematika" and "Amaliy  Matematika" all
 * collapse to the same key — and so do the various Uzbek apostrophes in
 * "Sun’iy intellekt" / "suniy-intellekt".
 *
 * The 202607300001 migration normalises stored rows with the identical rule
 * in SQL, so the database, the server and the client agree on what counts as
 * "the same direction".
 */
function directionKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

const BY_KEY: ReadonlyMap<string, DirectionOption> = (() => {
  const map = new Map<string, DirectionOption>()
  for (const option of [...ALL_DIRECTIONS, ...LEGACY_DIRECTIONS]) {
    // Both spellings resolve to the same canonical option.
    map.set(directionKey(option.value), option)
    map.set(directionKey(option.label), option)
  }
  return map
})()

export function directionsForFaculty(faculty: string | null | undefined): readonly DirectionOption[] {
  const key = (faculty ?? '').trim().toLowerCase()
  return FACULTY_DIRECTIONS[key as PermitFacultyValue] ?? ALL_DIRECTIONS
}

/** Canonical value for any known spelling, or null if unrecognised. */
export function normalizeDirection(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim()
  if (!raw) return null
  return BY_KEY.get(directionKey(raw))?.value ?? null
}

export function isDirectionValue(value: string | null | undefined) {
  return normalizeDirection(value) !== null
}

/**
 * Display text. Unrecognised values fall through unchanged rather than
 * disappearing — old data stays visible even if it predates this list.
 */
export function directionLabel(value: string | null | undefined): string {
  const raw = (value ?? '').trim()
  if (!raw) return ''
  return BY_KEY.get(directionKey(raw))?.label ?? raw
}

/** Faculty options, re-exported so screens pick faculty + direction together. */
export const FACULTY_OPTIONS = PERMIT_FACULTIES
