import { NextRequest, NextResponse } from 'next/server'
import { resolveAttendanceActor } from '@/features/attendance/server/actor'
import { createAttendanceService } from '@/features/attendance/server/service'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveAttendanceActor(request)
    return NextResponse.json(await createAttendanceService().summary(actor))
  } catch (error) {
    const r = getApiError(error, "Yo'qlama xulosasini yuklab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
