import { NextRequest, NextResponse } from 'next/server'
import { createApplicationService } from '@/features/applications/server/service'
import { requireActiveStudent } from '@/server/auth/guards'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { getApiError } from '@/server/http/api-error'

// The formal composer: server builds the UzMU-style ariza / tushuntirish
// text from the student's fields and signs it with their hand-drawn
// signature in one step.
export async function POST(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const throttle = await checkRateLimit(`ariza-formal:${student.id}:${getClientIp(request)}`, 8, 15 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Juda ko\'p urinish. Keyinroq qayta urining.' }, { status: 429 })
    }
    const body = await request.json().catch(() => ({}))
    return NextResponse.json(await createApplicationService().createFormalAriza(student.id, body, {
      ip: getClientIp(request) || null,
      userAgent: request.headers.get('user-agent'),
    }))
  } catch (error) {
    const r = getApiError(error, 'Arizani yuborib bo\'lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
