import { NextRequest, NextResponse } from 'next/server'
import { resolveAttendanceActor } from '@/features/attendance/server/actor'
import { createAttendanceService } from '@/features/attendance/server/service'
import { getApiError } from '@/server/http/api-error'

// GET  — open sessions the caller can see right now.
// POST — start an unscheduled ("adhoc") session for the caller's scope.
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveAttendanceActor(request)
    return NextResponse.json({ sessions: await createAttendanceService().activeSessions(actor) })
  } catch (error) {
    const r = getApiError(error, "Yo'qlama holatini yuklab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveAttendanceActor(request)
    return NextResponse.json(await createAttendanceService().openAdhoc(actor))
  } catch (error) {
    console.error('Attendance session POST error:', error)
    const r = getApiError(error, "Yo'qlamani ochib bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
