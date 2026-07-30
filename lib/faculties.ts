/**
 * Canonical faculty codes for the pre-enrollment permit-request flow
 * (ruxsatnoma-yuborish) and zamdekan registration. Both sides must use the
 * exact same `value`s — zamdekan overview matches permit_requests.faculty
 * against staff.faculty via a case-insensitive string equality check, so any
 * drift here (e.g. a free-typed faculty name vs. one of these codes) means a
 * zamdekan silently never sees permit requests meant for them.
 */
export const PERMIT_FACULTIES = [
  { value: 'amit', label: 'AMIT' },
  { value: 'tarix', label: 'Tarix' },
  { value: 'fizika', label: 'Fizika' },
  { value: 'kimyo', label: 'Kimyo' },
  { value: 'biologiya', label: 'Biologiya' },
] as const

export type PermitFacultyValue = (typeof PERMIT_FACULTIES)[number]['value']

export function isPermitFacultyValue(value: string): value is PermitFacultyValue {
  return PERMIT_FACULTIES.some((f) => f.value === value)
}

/**
 * Maps a stored faculty code (e.g. "amit") to its display label (e.g.
 * "AMIT"). Falls back to the raw value for any legacy/unrecognized data so
 * nothing silently disappears from the UI.
 */
export function permitFacultyLabel(value: string | null | undefined): string {
  if (!value) return ''
  const match = PERMIT_FACULTIES.find((f) => f.value === value.trim().toLowerCase())
  return match ? match.label : value
}
