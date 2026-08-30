export type IntegritySample = {
  id: string
  label: string
  /** faculty code / free text — shown as a secondary tag when present. */
  hint?: string
}

export type IntegrityCheck = {
  key: string
  title: string
  description: string
  /** How bad an outstanding count is — drives the card colour. */
  severity: 'danger' | 'warning' | 'info'
  count: number
  sample: IntegritySample[]
  /** Where in the panel the superadmin goes to fix these, if anywhere. */
  href?: string
}

export type IntegrityReport = {
  generatedAt: string
  checks: IntegrityCheck[]
}
