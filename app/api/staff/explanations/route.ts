import { NextRequest, NextResponse } from 'next/server'
import { createApplicationService } from '@/features/applications/server/service'
import { requireActiveStaff, requireStaffPermission } from '@/server/auth/guards'
import { staffDormFaculties, staffDormId } from '@/server/auth/faculty'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { getApiError } from '@/server/http/api-error'

// A tarbiyachi writes a tushuntirish xati ON A STUDENT'S BEHALF: they pick the
// student, type only the reason, the student signs on the tarbiyachi's screen.
// Scoped to students living in the tarbiyachi's own dorm building.

// GET ?studentId= — the picked student's details + how many letters they
// already have (and whether they are already red).
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['tarbiyachi'])
    requireStaffPermission(staff, 'explanations.write')
    const scope = {
      faculties: await staffDormFaculties(staff.id, staff.faculty),
      dormId: await staffDormId(staff.id, staff.faculty),
    }
    return NextResponse.json(
      await createApplicationService().explanationContext(scope, request.nextUrl.searchParams.get('studentId')),
    )
  } catch (error) {
    const response = getApiError(error, "Talaba ma'lumotini yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['tarbiyachi'])
    requireStaffPermission(staff, 'explanations.write')
    const throttle = await checkRateLimit(`explanation-onbehalf:${staff.id}`, 20, 15 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq qayta urining." }, { status: 429 })
    }
    const scope = {
      faculties: await staffDormFaculties(staff.id, staff.faculty),
      dormId: await staffDormId(staff.id, staff.faculty),
    }
    const body = await request.json().catch(() => null)
    return NextResponse.json(
      await createApplicationService().createExplanationOnBehalf(
        { id: staff.id, fullName: staff.full_name },
        scope,
        body,
        { ip: getClientIp(request) || null, userAgent: request.headers.get('user-agent') },
      ),
    )
  } catch (error) {
    const response = getApiError(error, "Tushuntirish xatini saqlab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
