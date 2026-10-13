import { NextRequest, NextResponse } from 'next/server'
import { resolveAttendanceActor } from '@/features/attendance/server/actor'
import { createAttendanceService } from '@/features/attendance/server/service'
import { createHomeLeaveService } from '@/features/home-leave/server/service'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveAttendanceActor(request)
    const summary = await createAttendanceService().summary(actor)
    // Talaba uyga ketish arizasi amalda bo'lsa, ekran "Uyda" holatini ko'rsatadi.
    if (actor.role === 'talaba') {
      const onLeave = await createHomeLeaveService().isOnLeave(actor.userId).catch(() => false)
      return NextResponse.json({ ...summary, onLeave })
    }
    return NextResponse.json(summary)
  } catch (error) {
    const r = getApiError(error, "Yo'qlama xulosasini yuklab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
