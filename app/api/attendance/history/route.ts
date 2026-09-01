import { NextRequest, NextResponse } from 'next/server'
import { resolveAttendanceActor } from '@/features/attendance/server/actor'
import { createAttendanceService } from '@/features/attendance/server/service'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    const studentId = request.nextUrl.searchParams.get('studentId')?.trim()
    if (!studentId || !/^[0-9a-f-]{36}$/i.test(studentId)) {
      return NextResponse.json({ error: 'studentId noto‘g‘ri' }, { status: 400 })
    }
    const actor = await resolveAttendanceActor(request)
    return NextResponse.json({ history: await createAttendanceService().history(actor, studentId) })
  } catch (error) {
    const r = getApiError(error, 'Tarixni yuklab bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
