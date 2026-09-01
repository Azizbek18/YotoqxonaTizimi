import { NextRequest, NextResponse } from 'next/server'
import { resolveAttendanceActor } from '@/features/attendance/server/actor'
import { createAttendanceService } from '@/features/attendance/server/service'
import { getApiError } from '@/server/http/api-error'

// GET  — "uzrsiz yo'q" flags awaiting the tarbiyachi's decision.
// POST — { recordId, action: 'warn' | 'dismiss' }
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveAttendanceActor(request)
    return NextResponse.json({ flags: await createAttendanceService().flags(actor) })
  } catch (error) {
    const r = getApiError(error, 'Bayroqlarni yuklab bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { recordId?: string; action?: string } | null
    const recordId = body?.recordId?.trim()
    if (!recordId || (body?.action !== 'warn' && body?.action !== 'dismiss')) {
      return NextResponse.json({ error: "So'rov noto'g'ri" }, { status: 400 })
    }
    const actor = await resolveAttendanceActor(request)
    const service = createAttendanceService()
    return NextResponse.json(
      body.action === 'warn'
        ? await service.promoteFlag(actor, recordId)
        : await service.dismissFlag(actor, recordId),
    )
  } catch (error) {
    const r = getApiError(error, 'Amalni bajarib bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
