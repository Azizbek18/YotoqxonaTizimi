/**
 * Canonical internal gender codes. Every form must store 'male'/'female' —
 * never the Uzbek display words directly — because several places (the
 * dekan room map's mixed-gender check, admin reports, room assignment)
 * compare this value with `=== 'male'`/`=== 'female'`. A free-text field
 * that let someone type "Erkak"/"Ayol" straight into the column silently
 * broke those comparisons: rooms full of only male students got flagged as
 * "mixed", and male students rendered as "Ayol" because the display ternary
 * defaults to female for anything that isn't literally 'male'.
 */
export type GenderValue = 'male' | 'female'

export const GENDER_OPTIONS: { value: GenderValue; label: string }[] = [
  { value: 'male', label: 'Erkak' },
  { value: 'female', label: 'Ayol' },
]

/**
 * Tolerates legacy rows where 'Erkak'/'Ayol' were stored directly (see
 * above) so existing bad data still displays/compares correctly while it
 * gets backfilled.
 */
export function normalizeGender(value: string | null | undefined): GenderValue | null {
  const v = (value ?? '').trim().toLowerCase()
  if (v === 'male' || v === 'erkak') return 'male'
  if (v === 'female' || v === 'ayol') return 'female'
  return null
}

export function genderLabel(value: string | null | undefined): string {
  const normalized = normalizeGender(value)
  if (normalized === 'male') return 'Erkak'
  if (normalized === 'female') return 'Ayol'
  return value?.trim() || "Noma'lum"
}

/**
 * Shared gender identity for the dekan panel (room map, arizalar avatars,
 * student list). Gender is carried by hue — male = blue, female = pink —
 * per an explicit product call (2026-08-29): the dekan wanted rooms on the
 * Xona xaritasi to read as boy/girl at a glance. Consistent everywhere so
 * the same person never gets recoloured between pages. `letter` is the
 * fallback cue where a colour alone would be too subtle (dense room-map
 * beds). Rose stays reserved for the genuine mixed-gender error.
 */
export function genderAccent(value: string | null | undefined) {
  const normalized = normalizeGender(value)
  if (normalized === 'male') {
    return {
      letter: 'E',
      dot: 'bg-blue-500',
      text: 'text-blue-500',
      badgeBg: 'bg-blue-500/10',
      badgeBgLight: 'bg-blue-100/70',
      border: 'border-blue-500/25',
      borderLight: 'border-blue-200',
    }
  }
  if (normalized === 'female') {
    return {
      letter: 'A',
      dot: 'bg-pink-500',
      text: 'text-pink-500',
      badgeBg: 'bg-pink-500/10',
      badgeBgLight: 'bg-pink-100/70',
      border: 'border-pink-500/30',
      borderLight: 'border-pink-200',
    }
  }
  return {
    letter: '?',
    dot: 'bg-slate-300',
    text: 'text-slate-400',
    badgeBg: 'bg-slate-500/10',
    badgeBgLight: 'bg-slate-100',
    border: 'border-slate-400/20',
    borderLight: 'border-slate-200',
  }
}
