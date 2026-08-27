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
 * Shared gender identity for the dekan panel (room map, arizalar avatars).
 * The panel runs on a single indigo-on-slate palette, so gender is carried
 * by weight/shade rather than hue: male = indigo (the panel accent),
 * female = slate. Consistent everywhere so the same person never gets
 * recoloured between pages. `letter` is the fallback cue where a colour
 * alone would be too subtle (dense room-map beds).
 */
export function genderAccent(value: string | null | undefined) {
  const normalized = normalizeGender(value)
  if (normalized === 'male') {
    return {
      letter: 'E',
      dot: 'bg-indigo-500',
      text: 'text-indigo-500',
      badgeBg: 'bg-indigo-500/10',
      badgeBgLight: 'bg-indigo-100/70',
      border: 'border-indigo-500/25',
      borderLight: 'border-indigo-200',
    }
  }
  if (normalized === 'female') {
    return {
      letter: 'A',
      dot: 'bg-slate-400',
      text: 'text-slate-500',
      badgeBg: 'bg-slate-500/10',
      badgeBgLight: 'bg-slate-200/70',
      border: 'border-slate-400/30',
      borderLight: 'border-slate-300',
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
