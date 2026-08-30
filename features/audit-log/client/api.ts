'use client'

import { apiRequest } from '@/lib/api-client'
import type { AuditLogPage } from '../types'

export function fetchAuditLog(params: {
  limit?: number
  offset?: number
  eventType?: string
  status?: string
  since?: string
}): Promise<AuditLogPage> {
  const search = new URLSearchParams()
  if (params.limit) search.set('limit', String(params.limit))
  if (params.offset) search.set('offset', String(params.offset))
  if (params.eventType) search.set('eventType', params.eventType)
  if (params.status) search.set('status', params.status)
  if (params.since) search.set('since', params.since)
  return apiRequest<AuditLogPage>(`/api/admin/audit-log?${search.toString()}`, undefined, "Audit jurnalini yuklab bo'lmadi")
}
