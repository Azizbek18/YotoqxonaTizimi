import { NextRequest, NextResponse } from 'next/server'
import { createStaffAccountService } from '@/features/staff-accounts/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { staffFacultyOrPrimary } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'

function errorResponse(error: unknown) {
  console.error('Admin staff-accounts API error:', error)
  const response = getApiError(error, "So'rovni bajarib bo'lmadi")
  return NextResponse.json(response.body, { status: response.status })
}

// Tarbiyachi account management. Open to dekan (their own faculty) and,
// during the admin -> dekan transition, admin (the primary building). New
// tarbiyachi rows are bound to that faculty; the list is scoped to it.
// The full invite-based onboarding flow lands in Bosqich 3.
export async function GET(request: NextRequest) {
  try {
    const { staff: caller } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = staffFacultyOrPrimary(caller.faculty)
    return NextResponse.json({ staff: await createStaffAccountService().list(faculty) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, staff: caller } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = staffFacultyOrPrimary(caller.faculty)
    const throttle = await checkRateLimit(`admin-staff-create:${user.id}`, 10, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const result = await createStaffAccountService().create(user.id, faculty, await request.json())
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
