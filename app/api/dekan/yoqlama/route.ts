import { NextRequest, NextResponse, after } from 'next/server'
import { checkRateLimit } from '@/lib/security'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'
import { createDekanAttendanceService, type DekanScope } from '@/features/attendance/server/dekan-service'

export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Dekan yo'qlamasi. FAQAT dekan / superadmin (tanlangan fakultet doirasida);
// tarbiyachi va sardor bu bo'limga kira olmaydi. Har bir amal fakultet va
// yotoqxona bo'yicha service ichida qayta tekshiriladi.
async function resolveScope(request: NextRequest): Promise<DekanScope> {
  const { user, staff } = await requireActiveStaff(request, ['dekan', 'admin'])
  return { userId: user.id, faculty: requirePickedFaculty(staff) }
}

function errorResponse(error: unknown, fallback: string) {
  const r = getApiError(error, fallback)
  return NextResponse.json(r.body, { status: r.status })
}

// GET            — dorms of the faculty + active/recent sessions
// GET ?sessionId — one session's live roster
// GET ?history=1&days=7&dormId? — several days of this faculty's roll-calls
export async function GET(request: NextRequest) {
  try {
    const scope = await resolveScope(request)
    const sessionId = request.nextUrl.searchParams.get('sessionId')?.trim()
    const service = createDekanAttendanceService()
    if (request.nextUrl.searchParams.get('history')) {
      const dormId = request.nextUrl.searchParams.get('dormId')?.trim() || null
      if (dormId && !UUID.test(dormId)) return NextResponse.json({ error: 'dormId noto‘g‘ri' }, { status: 400 })
      const days = Number(request.nextUrl.searchParams.get('days') ?? 7)
      return NextResponse.json(await service.history(scope, { dormId, days }))
    }
    if (sessionId) {
      if (!UUID.test(sessionId)) return NextResponse.json({ error: 'sessionId noto‘g‘ri' }, { status: 400 })
      return NextResponse.json(await service.roster(scope, sessionId))
    }
    return NextResponse.json(await service.overview(scope))
  } catch (error) {
    return errorResponse(error, 'Yo‘qlamani yuklab bo‘lmadi')
  }
}

// POST { dormId, startsAt?, closesAt } — start now (no startsAt) or schedule.
export async function POST(request: NextRequest) {
  try {
    const scope = await resolveScope(request)
    const throttle = await checkRateLimit(`dekan-attendance-create:${scope.userId}`, 10, 10 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Juda ko‘p urinish. Birozdan keyin qayta uring.' }, { status: 429 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      dormId?: unknown
      startsAt?: unknown
      closesAt?: unknown
    }
    if (typeof body.dormId !== 'string' || !UUID.test(body.dormId)) {
      return NextResponse.json({ error: 'Yotoqxona tanlanmagan' }, { status: 400 })
    }
    if (typeof body.closesAt !== 'string' || !body.closesAt) {
      return NextResponse.json({ error: 'Tugash vaqti ko‘rsatilmagan' }, { status: 400 })
    }
    if (body.startsAt != null && typeof body.startsAt !== 'string') {
      return NextResponse.json({ error: 'Boshlanish vaqti noto‘g‘ri' }, { status: 400 })
    }

    const service = createDekanAttendanceService()
    const { session, startedNow } = await service.create(scope, {
      dormId: body.dormId,
      startsAt: (body.startsAt as string | null | undefined) || null,
      closesAt: body.closesAt,
    })

    // First Telegram/email/push round goes out after the response so a slow
    // mail provider never makes the dekan wait. A scheduled session is
    // announced by the cron when it opens.
    if (startedNow) after(() => service.deliverStart(session.id).catch((e) => console.error('deliverStart failed:', e)))

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    console.error('Dekan attendance POST error:', error)
    return errorResponse(error, 'Yo‘qlamani boshlab bo‘lmadi')
  }
}

// PATCH { sessionId } — end an open roll-call / cancel a scheduled one.
export async function PATCH(request: NextRequest) {
  try {
    const scope = await resolveScope(request)
    const body = (await request.json().catch(() => ({}))) as { sessionId?: unknown }
    if (typeof body.sessionId !== 'string' || !UUID.test(body.sessionId)) {
      return NextResponse.json({ error: 'sessionId noto‘g‘ri' }, { status: 400 })
    }
    return NextResponse.json(await createDekanAttendanceService().close(scope, body.sessionId))
  } catch (error) {
    return errorResponse(error, 'Yo‘qlamani yakunlab bo‘lmadi')
  }
}
