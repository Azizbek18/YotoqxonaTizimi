import { NextRequest, NextResponse } from 'next/server'
import { resolveAttendanceActor } from '@/features/attendance/server/actor'
import { createAttendanceService } from '@/features/attendance/server/service'
import { getApiError } from '@/server/http/api-error'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { sessionId?: string } | null
    const sessionId = body?.sessionId?.trim()
    if (!sessionId) return NextResponse.json({ error: 'sessionId kerak' }, { status: 400 })
    const actor = await resolveAttendanceActor(request)
    return NextResponse.json(await createAttendanceService().close(actor, sessionId))
  } catch (error) {
    const r = getApiError(error, "Yo'qlamani yopib bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
