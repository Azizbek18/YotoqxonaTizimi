import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { AuditLogQuery } from '../types'

type RawEntry = {
  id: string
  event_type: string
  status: string
  ip_address: string | null
  actor_user_id: string | null
  target_role: string | null
  details: Record<string, unknown> | null
  created_at: string
}

export function createAuditLogRepository() {
  const supabase = getServiceSupabase()

  return {
    async list(query: AuditLogQuery): Promise<{ rows: RawEntry[]; total: number }> {
      let q = supabase
        .from('security_audit_logs')
        .select('id, event_type, status, ip_address, actor_user_id, target_role, details, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (query.eventType) q = q.eq('event_type', query.eventType)
      if (query.status) q = q.eq('status', query.status)
      if (query.since) q = q.gte('created_at', query.since)

      const { data, error, count } = await q.range(query.offset, query.offset + query.limit - 1)
      if (error) throw error
      return { rows: (data ?? []) as RawEntry[], total: count ?? 0 }
    },

    // Distinct event_type values for the filter dropdown. The table is
    // append-only and small (early-stage) — a bounded scan of recent rows
    // covers every type in practice; revisit with a materialised list at scale.
    async distinctEventTypes(): Promise<string[]> {
      const { data, error } = await supabase
        .from('security_audit_logs')
        .select('event_type')
        .order('created_at', { ascending: false })
        .limit(2000)
      if (error) throw error
      return Array.from(new Set((data ?? []).map((r) => String(r.event_type)))).sort()
    },

    // Resolve actor ids to a display name + role across both identity tables.
    async resolveActors(ids: string[]): Promise<Map<string, { name: string; role: string }>> {
      const map = new Map<string, { name: string; role: string }>()
      if (ids.length === 0) return map
      const [staff, users] = await Promise.all([
        supabase.from('staff').select('id, full_name, role').in('id', ids),
        supabase.from('users').select('id, full_name, role').in('id', ids),
      ])
      for (const row of staff.data ?? []) {
        map.set(String(row.id), { name: String(row.full_name ?? '—'), role: String(row.role ?? 'staff') })
      }
      for (const row of users.data ?? []) {
        if (!map.has(String(row.id))) {
          map.set(String(row.id), { name: String(row.full_name ?? '—'), role: String(row.role ?? 'talaba') })
        }
      }
      return map
    },
  }
}

export type AuditLogRepository = ReturnType<typeof createAuditLogRepository>
