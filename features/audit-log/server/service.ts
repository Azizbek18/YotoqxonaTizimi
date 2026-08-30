import 'server-only'
import type { AuditLogEntry, AuditLogPage, AuditLogQuery, AuditLogStatus } from '../types'
import { createAuditLogRepository, type AuditLogRepository } from './repository'

const STATUSES: AuditLogStatus[] = ['success', 'denied', 'error']
const MAX_LIMIT = 100
const DEFAULT_LIMIT = 40

export function parseAuditLogQuery(params: URLSearchParams): AuditLogQuery {
  const rawLimit = Number(params.get('limit'))
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, MAX_LIMIT) : DEFAULT_LIMIT
  const rawOffset = Number(params.get('offset'))
  const offset = Number.isInteger(rawOffset) && rawOffset >= 0 ? rawOffset : 0

  const status = params.get('status')
  const since = params.get('since')

  return {
    limit,
    offset,
    eventType: params.get('eventType')?.trim() || undefined,
    status: STATUSES.includes(status as AuditLogStatus) ? (status as AuditLogStatus) : undefined,
    since: since && !Number.isNaN(Date.parse(since)) ? new Date(since).toISOString() : undefined,
  }
}

export function createAuditLogService(repository: AuditLogRepository = createAuditLogRepository()) {
  return {
    async getPage(query: AuditLogQuery): Promise<AuditLogPage> {
      const [{ rows, total }, eventTypes] = await Promise.all([
        repository.list(query),
        repository.distinctEventTypes(),
      ])

      const actorIds = Array.from(
        new Set(rows.map((r) => r.actor_user_id).filter((id): id is string => Boolean(id))),
      )
      const actors = await repository.resolveActors(actorIds)

      const entries: AuditLogEntry[] = rows.map((r) => {
        const actor = r.actor_user_id ? actors.get(r.actor_user_id) : undefined
        return {
          id: r.id,
          eventType: r.event_type,
          status: (STATUSES.includes(r.status as AuditLogStatus) ? r.status : 'success') as AuditLogStatus,
          actorId: r.actor_user_id,
          actorName: actor?.name ?? null,
          actorRole: actor?.role ?? null,
          targetRole: r.target_role,
          ipAddress: r.ip_address,
          details: (r.details ?? {}) as Record<string, unknown>,
          createdAt: r.created_at,
        }
      })

      return { entries, total, eventTypes }
    },
  }
}
