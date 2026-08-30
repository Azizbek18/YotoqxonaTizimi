import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/server/auth/guards'
import { createAuditLogService, parseAuditLogQuery } from '@/features/audit-log/server/service'
import { getApiError } from '@/server/http/api-error'

// Superadmin-only security audit trail. Read-only — the log is written
// server-side by lib/audit-log.ts and has no client policy.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const query = parseAuditLogQuery(request.nextUrl.searchParams)
    return NextResponse.json(await createAuditLogService().getPage(query))
  } catch (error) {
    console.error('Audit log API error:', error)
    const response = getApiError(error, "Audit jurnalini yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
