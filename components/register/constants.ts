// Shared registration-wizard constants. STUDY_TYPES lived in the (now removed)
// Step4Study; the read-only summary in Step8Room and the server all key off the
// same `grant` / `kontrakt` values the imtiyozli-ariza form writes.

export const STUDY_TYPES = [
  { value: 'grant', label: 'Davlat granti' },
  { value: 'kontrakt', label: "To'lov-shartnoma" },
] as const

export function studyTypeLabel(value: string | null | undefined): string {
  return STUDY_TYPES.find((s) => s.value === value)?.label ?? (value || '—')
}

// "Qadam 03 / 08" — the step list is now filtered per application type, so the
// count must come from props, not a hardcoded string per step file.
export function stepLabel(stepNumber: number, totalSteps: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `Qadam ${pad(stepNumber)} / ${pad(totalSteps)}`
}
