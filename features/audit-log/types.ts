export type AuditLogStatus = 'success' | 'denied' | 'error'

export type AuditLogEntry = {
  id: string
  eventType: string
  status: AuditLogStatus
  actorId: string | null
  actorName: string | null
  actorRole: string | null
  targetRole: string | null
  ipAddress: string | null
  details: Record<string, unknown>
  createdAt: string
}

export type AuditLogPage = {
  entries: AuditLogEntry[]
  total: number
  /** Distinct event_type values seen in the table — drives the filter dropdown. */
  eventTypes: string[]
}

export type AuditLogQuery = {
  limit: number
  offset: number
  eventType?: string
  status?: AuditLogStatus
  /** ISO date — only entries at or after this instant. */
  since?: string
}
