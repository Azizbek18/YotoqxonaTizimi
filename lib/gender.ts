/**
 * Canonical internal gender codes. Every form must store 'male'/'female' —
 * never the Uzbek display words directly — because several places (the
 * zamdekan room map's mixed-gender check, admin reports, room assignment)
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
 * Shared color identity for gender across the zamdekan panel (room map,
 * arizalar avatars/badges) — sky for male, rose for female everywhere, so
 * the same entity never gets recolored between pages.
 */
export function genderAccent(value: string | null | undefined) {
  const normalized = normalizeGender(value)
  if (normalized === 'male') {
    return {
      dot: 'bg-sky-500',
      text: 'text-sky-500',
      badgeBg: 'bg-sky-500/10',
      badgeBgLight: 'bg-sky-100/70',
      border: 'border-sky-500/25',
      borderLight: 'border-sky-300',
    }
  }
  if (normalized === 'female') {
    return {
      dot: 'bg-rose-500',
      text: 'text-rose-500',
      badgeBg: 'bg-rose-500/10',
      badgeBgLight: 'bg-rose-100/70',
      border: 'border-rose-500/25',
      borderLight: 'border-rose-300',
    }
  }
  return {
    dot: 'bg-slate-400',
    text: 'text-slate-400',
    badgeBg: 'bg-slate-500/10',
    badgeBgLight: 'bg-slate-100',
    border: 'border-slate-500/20',
    borderLight: 'border-slate-300',
  }
}
