import { NextRequest, NextResponse } from 'next/server'
import { createFacultyStudentsService } from '@/features/faculty-students/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'

export async function POST(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    // A warning is written to the student's disciplinary record and emails
    // them — throttle it harder than a room assignment so a stuck UI (or a
    // frustrated click-spree) can't bury someone under duplicate warnings.
    const throttle = await checkRateLimit(`dekan-warning:${staff.id}`, 10, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const body = await request.json().catch(() => null)
    const result = await createFacultyStudentsService().sendWarning(staff.faculty, body)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Dekan warning API error:', error)
    const response = getApiError(error, "Ogohlantirishni yuborib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
