import { NextRequest, NextResponse } from 'next/server'
import { resolveAttendanceActor } from '@/features/attendance/server/actor'
import { createAttendanceService } from '@/features/attendance/server/service'
import { getApiError } from '@/server/http/api-error'
import type { AttendanceState } from '@/features/attendance/types'

const STATES: AttendanceState[] = ['present', 'absent', 'excused']

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as
      { sessionId?: string; studentId?: string; state?: string } | null
    const sessionId = body?.sessionId?.trim()
    const studentId = body?.studentId?.trim()
    const state = body?.state
    if (!sessionId || !studentId || !state || !STATES.includes(state as AttendanceState)) {
      return NextResponse.json({ error: "So'rov noto'g'ri" }, { status: 400 })
    }
    const actor = await resolveAttendanceActor(request)
    return NextResponse.json({ record: await createAttendanceService().mark(actor, sessionId, studentId, state as AttendanceState) })
  } catch (error) {
    const r = getApiError(error, 'Belgilashда xatolik')
    return NextResponse.json(r.body, { status: r.status })
  }
}
