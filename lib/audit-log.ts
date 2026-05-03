import 'server-only'
import { getServiceSupabase } from '@/lib/server-supabase'

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
      details: params.details ?? {},
    })
  } catch {
    // audit yozuvi buzilishi asosiy oqimni to'xtatmasin
  }
}
