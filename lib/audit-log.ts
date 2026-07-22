import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { Json } from '@/types/database.generated'

type AuditStatus = 'success' | 'denied' | 'error'

export async function writeAuditLog(params: {
  eventType: string
  status: AuditStatus
  ipAddress?: string
  actorUserId?: string | null
  targetRole?: string | null
  details?: Record<string, unknown>
}) {
  try {
    const supabase = getServiceSupabase()
    await supabase.from('security_audit_logs').insert({
      event_type: params.eventType,
      status: params.status,
      ip_address: params.ipAddress ?? null,
      actor_user_id: params.actorUserId ?? null,
      target_role: params.targetRole ?? null,
      details: (params.details ?? {}) as Json,
    })
  } catch {
    // audit yozuvi buzilishi asosiy oqimni to'xtatmasin
  }
}
