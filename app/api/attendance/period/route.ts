import { NextRequest, NextResponse } from 'next/server'
import { resolveAttendanceActor } from '@/features/attendance/server/actor'
import { createDekanAttendanceService } from '@/features/attendance/server/dekan-service'
import { ApiError, getApiError } from '@/server/http/api-error'

export const runtime = 'nodejs'

// Tarbiyachi: oxirgi N kunlik yo'qlama (kim bosgan / bosmagan) — o'z binosi bo'yicha, faqat ko'rish.
// GET ?days=7|14|30
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveAttendanceActor(request)
    if (actor.role !== 'tarbiyachi') throw new ApiError(403, 'Faqat tarbiyachi', 'FORBIDDEN')
    const days = Number(request.nextUrl.searchParams.get('days') ?? 7)
    const view = await createDekanAttendanceService().buildingHistory({
      dormId: actor.dormId,
      gender: actor.gender,
      days,
    })
    return NextResponse.json(view)
  } catch (error) {
    const r = getApiError(error, 'Kunlar bo‘yicha ma’lumotni yuklab bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
