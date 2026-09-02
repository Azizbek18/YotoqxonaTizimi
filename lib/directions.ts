import { PERMIT_FACULTIES, type PermitFacultyValue } from '@/lib/faculties'

/**
 * Canonical study directions (yo'nalish), keyed by the faculty codes in
 * lib/faculties.ts. Every entry point picks from this list and stores the
 * `value`; `directionLabel` turns it back into readable text, and
 * `normalizeDirection` maps legacy free-typed spellings onto the same value.
 *
 * Bakalavr yo'nalishlari only. Source: each faculty's nuu.uz page
 * (Bakalavriat section), captured 2026-08-28. Programmes a faculty no longer
 * offers move to LEGACY_DIRECTIONS below — never selectable, still resolved
 * so an older student record keeps displaying as readable text.
 *
 * nuu.uz only surfaced the journalism side of `ozbek-filologiyasi` and the
 * translation side of `xorijiy-filologiya` (re-checked 2026-08-28). The
 * teaching directions below ("Filologiya va tillarni o'qitish (X tili)",
 * OO'YMTV kodi 60111400) are added from the national bachelor classifier so
 * a real applicant there isn't rejected at submission; refine the exact
 * labels if the faculty confirms otherwise.
 */

export type DirectionOption = { value: string; label: string }

export const FACULTY_DIRECTIONS: Record<PermitFacultyValue, readonly DirectionOption[]> = {
  matematika: [
    { value: 'mexanika-modellashtirish', label: 'Mexanika va matematik modellashtirish' },
    { value: 'matematika', label: 'Matematika' },
  ],
  amit: [
    { value: 'suniy-intellekt', label: 'Sun’iy intellekt' },
    { value: 'axborot-xavfsizligi', label: 'Axborot xavfsizligi' },
    { value: 'axborot-tizimlari', label: 'Axborot tizimlari va texnologiyalari' },
    { value: 'kompyuter-ilmlari', label: 'Kompyuter ilmlari va dasturlash texnologiyalari' },
    { value: 'amaliy-matematika', label: 'Amaliy matematika' },
    { value: 'matematik-va-kompyuterli-modellashtirish', label: 'Matematik va kompyuterli modellashtirish' },
    { value: 'kiberxavfsizlik', label: 'Kiberxavfsizlik' },
  ],
  fizika: [
    { value: 'tibbiyot-fizikasi', label: 'Tibbiyot fizikasi' },
    { value: 'astronomiya', label: 'Astronomiya' },
    { value: 'fizika', label: 'Fizika' },
    { value: 'fizika-matematik', label: 'Fizika (matematik fizika)' },
  ],
  kimyo: [
    { value: 'mahsulot-kimyoviy-analizi', label: 'Mahsulotlarning kimyoviy analizi (oziq-ovqat mahsulotlari)' },
    { value: 'tabiiy-birikmalar-kimyosi', label: 'Tabiiy birikmalar kimyosi' },
    { value: 'polimerlar-kimyosi', label: 'Polimerlar kimyosi (tarmoqlar bo’yicha)' },
    { value: 'neft-gaz-kimyosi', label: 'Umumiy va neft-gaz kimyosi' },
    { value: 'kimyo', label: 'Kimyo (turlari bo’yicha)' },
  ],
  biologiya: [
    { value: 'biotexnologiya', label: 'Biotexnologiya (tarmoqlar bo’yicha)' },
    { value: 'biologiya', label: 'Biologiya (turlari bo’yicha)' },
    { value: 'ekologiya-atrof-muhit', label: 'Ekologiya (atrof-muhit muhofazasi)' },
    { value: 'agrokimyo-tuproqshunoslik', label: 'Agrokimyo va tuproqshunoslik' },
    { value: 'hayot-faoliyati-xavfsizligi', label: 'Hayot faoliyati xavfsizligi' },
  ],
  geologiya: [
    { value: 'konlarni-geomodellashtirish', label: 'Foydali qazilma konlarini baholash va geomodellashtirish' },
    { value: 'geokimyo', label: 'Geokimyo' },
    { value: 'geofizika', label: 'Geofizika' },
    { value: 'geologiya', label: 'Geologiya (faoliyat sohalari bo’yicha)' },
  ],
  geografiya: [
    { value: 'geodeziya-kartografiya', label: 'Geodeziya, kartografiya va kadastr' },
    { value: 'geografiya', label: 'Geografiya' },
  ],
  iqtisodiyot: [
    // Confirmed with the faculty (Joʻrabek X., 2026-08-30). The 4th course
    // swaps "Soliq va soliqqa tortish" for "Sug'urta ishi"; both are offered
    // here since the form doesn't filter directions by course. The first
    // three run separate Uzbek and Russian groups — the dean needs to tell
    // an applicant's group apart, so it is baked into the direction (same
    // as the philology faculties' per-language entries). Existing rows keep
    // the base value and now read "(o'zbek)"; the dean re-points the few
    // Russian-group students by hand.
    { value: 'iqtisodiyot-tarmoqlar', label: 'Iqtisodiyot (tarmoqlar va sohalar bo’yicha) (o’zbek)' },
    { value: 'iqtisodiyot-tarmoqlar-rus', label: 'Iqtisodiyot (tarmoqlar va sohalar bo’yicha) (rus)' },
    { value: 'jahon-iqtisodiyoti', label: 'Jahon iqtisodiyoti va xalqaro iqtisodiy munosabatlar (o’zbek)' },
    { value: 'jahon-iqtisodiyoti-rus', label: 'Jahon iqtisodiyoti va xalqaro iqtisodiy munosabatlar (rus)' },
    { value: 'bank-ishi', label: 'Bank ishi (o’zbek)' },
    { value: 'bank-ishi-rus', label: 'Bank ishi (rus)' },
    { value: 'moliya-texnologiyalari', label: 'Moliya va moliyaviy texnologiyalar' },
    { value: 'soliq-soliqqa-tortish', label: 'Soliq va soliqqa tortish' },
    { value: 'sugurta-ishi', label: 'Sug’urta ishi' },
    { value: 'menejment', label: 'Menejment (tarmoqlar va sohalar bo’yicha)' },
    { value: 'inson-resurslari', label: 'Inson resurslarini boshqarish' },
    { value: 'byudjet-gaznachilik', label: 'Byudjet nazorati va g’aznachiligi' },
    { value: 'ijtimoiy-ish', label: 'Ijtimoiy ish' },
  ],
  tarix: [
    { value: 'antropologiya-etnologiya', label: 'Antropologiya va etnologiya' },
    { value: 'arxivshunoslik', label: 'Arxivshunoslik' },
    { value: 'arxeologiya', label: 'Arxeologiya' },
    { value: 'tarix', label: 'Tarix' },
  ],
  'ijtimoiy-fanlar': [
    { value: 'milliy-goya', label: 'Milliy g’oya, ma’naviyat asoslari va huquq ta’limi' },
    { value: 'ijtimoiy-ish', label: 'Ijtimoiy ish' },
    { value: 'siyosatshunoslik', label: 'Siyosatshunoslik' },
    { value: 'sotsiologiya', label: 'Sotsiologiya' },
    { value: 'yurisprudensiya', label: 'Yurisprudensiya' },
  ],
  'xorijiy-filologiya': [
    // Faculty-confirmed list (Joʻrabek X., 2026-09-01): the Russian /
    // O'zbek-language and Ona-tili programmes belong to the o'zbek
    // filologiya faculty, not this one — dropped here.
    { value: 'filologiya-ingliz', label: 'Filologiya va tillarni o’qitish (ingliz tili)' },
    { value: 'filologiya-nemis', label: 'Filologiya va tillarni o’qitish (nemis tili)' },
    { value: 'filologiya-fransuz', label: 'Filologiya va tillarni o’qitish (fransuz tili)' },
    { value: 'tarjima-ingliz', label: 'Tarjima nazariyasi va amaliyoti (ingliz tili)' },
    { value: 'tarjima-nemis', label: 'Tarjima nazariyasi va amaliyoti (nemis tili)' },
    { value: 'tarjima-fransuz', label: 'Tarjima nazariyasi va amaliyoti (fransuz tili)' },
    { value: 'xorijiy-til-va-adabiyoti', label: 'Xorijiy til va adabiyoti' },
  ],
  'ozbek-filologiyasi': [
    // Faculty confirmed (Joʻrabek X., 2026-08-30) that its filologiya
    // programme also runs a Russian group — `filologiya-rus` lives here.
    { value: 'filologiya-ozbek', label: 'Filologiya va tillarni o’qitish (o’zbek tili)' },
    { value: 'filologiya-rus', label: 'Filologiya va tillarni o’qitish (rus tili)' },
    { value: 'jurnalistika', label: 'Jurnalistika' },
    { value: 'jurnalistika-oav', label: 'Jurnalistika (OAV faoliyati)' },
    { value: 'jurnalistika-bosma', label: 'Jurnalistika (bosma OAV jurnalistikasi)' },
    { value: 'jurnalistika-internet', label: 'Jurnalistika (internet jurnalistika)' },
    { value: 'axborot-xizmati-pr', label: 'Axborot xizmati va jamoatchilik bilan aloqalar' },
  ],
  sport: [
    { value: 'sport-erkin-kurash', label: 'Sport faoliyati (erkin kurash)' },
    { value: 'sport-kurash', label: 'Sport faoliyati (kurash)' },
    { value: 'sport-dzyudo', label: 'Sport faoliyati (dzyudo)' },
    { value: 'sport-menejment', label: 'Menejment (sport tadbirlarini tashkil etish va boshqarish)' },
    { value: 'sport-tadbirlari', label: 'Sport tadbirlarini tashkil etish va boshqarish' },
  ],
}

/**
 * Directions that were selectable before the faculty list matched the real
 * university structure (older AMIT sub-topics, and programmes from faculty
 * screens that predate this list). Never offered for selection — kept only
 * so an existing record still normalises and displays as readable text
 * instead of a bare slug.
 */
const LEGACY_DIRECTIONS: readonly DirectionOption[] = [
  // Retired AMIT sub-topics
  { value: 'matematik-tahlil', label: 'Matematik tahlil' },
  { value: 'funksional-tahlil', label: 'Funksional tahlil' },
  { value: 'differensial-tenglamalar', label: 'Differensial tenglamalar' },
  { value: 'dasturiy-injiniring', label: 'Dasturiy injiniring' },
  { value: 'kompyuter-tarmoqlari', label: 'Kompyuter tarmoqlari' },
  { value: 'raqamli-forensika', label: 'Raqamli forensika' },
  // Retired physics / chemistry / biology / history programmes
  { value: 'nazariy-fizika', label: 'Nazariy fizika' },
  { value: 'atom-fizikasi', label: 'Atom va molekulyar fizika' },
  { value: 'energetika', label: 'Energetika' },
  { value: 'organik-kimyo', label: 'Organik kimyo' },
  { value: 'analitik-kimyo', label: 'Analitik kimyo' },
  { value: 'noorganik-kimyo', label: 'Noorganik kimyo' },
  { value: 'genetika', label: 'Genetika' },
  { value: 'mikrobiologiya', label: 'Mikrobiologiya' },
  { value: 'uzbekiston-tarixi', label: 'O‘zbekiston tarixi' },
  { value: 'jahon-tarixi', label: 'Jahon tarixi' },
  // Programmes from faculty screens that predate the unified list
  { value: 'geologiya-umumiy', label: 'Umumiy geologiya' },
  { value: 'kon-geologiyasi', label: 'Kon geologiyasi' },
  { value: 'gidrogeologiya', label: 'Gidrogeologiya' },
  { value: 'geoekologiya', label: 'Geoekologiya' },
  { value: 'geoinformatika', label: 'Geoinformatika' },
  { value: 'turizm', label: 'Turizm' },
  { value: 'psixologiya', label: 'Psixologiya' },
  { value: 'falsafa', label: 'Falsafa' },
  { value: 'fuqarolik-huquqi', label: 'Fuqarolik huquqi' },
  { value: 'jinoyat-huquqi', label: 'Jinoyat huquqi' },
  { value: 'xalqaro-huquq', label: 'Xalqaro huquq' },
  { value: 'iqtisodiyot', label: 'Iqtisodiyot' },
  { value: 'moliya', label: 'Moliya' },
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
  // Dropped from the xorijiy-filologiya picker 2026-09-01 (belong to the
  // o'zbek filologiya faculty); kept resolvable for any stored rows.
  { value: 'rus-tili-ozga-guruh', label: 'O’zga tilli guruhlarda rus tili' },
  { value: 'ona-tili-adabiyoti', label: 'Ona tili va adabiyoti' },
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
 * True when `direction` is one of `faculty`'s own bachelor programmes. Entry
 * forms send faculty + direction together, so a mismatch means a hand-crafted
 * request — reject it rather than store a student under a faculty whose
 * dekan's direction filters will never surface them. Unknown faculty codes
 * fall through to ALL_DIRECTIONS (directionsForFaculty), i.e. any valid
 * direction, so this never blocks a faculty that predates the list.
 */
export function directionBelongsToFaculty(
  faculty: string | null | undefined,
  direction: string | null | undefined,
) {
  const canonical = normalizeDirection(direction)
  if (!canonical) return false
  return directionsForFaculty(faculty).some((option) => option.value === canonical)
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
