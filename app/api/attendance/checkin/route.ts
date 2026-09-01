import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStudent } from '@/server/auth/guards'
import { normalizeFaculty } from '@/lib/faculties'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { createAttendanceService } from '@/features/attendance/server/service'
import { getApiError } from '@/server/http/api-error'

// Talaba "Yotoqxonadaman" tugmasini bosganda — joylashuv serverda tekshiriladi.
export async function POST(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const throttle = await checkRateLimit(`attendance-checkin:${student.id}:${getClientIp(request)}`, 8, 10 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Juda ko‘p urinish. Birozdan keyin qayta uring.' }, { status: 429 })
    }

    const faculty = normalizeFaculty(student.faculty)
    if (!faculty) return NextResponse.json({ status: 'no_session' })

    const body = await request.json().catch(() => ({})) as { lat?: unknown; lng?: unknown; accuracy?: unknown }
    return NextResponse.json(await createAttendanceService().checkin(student.id, faculty, body))
  } catch (error) {
    const r = getApiError(error, 'Tasdiqlashda xatolik')
    return NextResponse.json(r.body, { status: r.status })
  }
}
