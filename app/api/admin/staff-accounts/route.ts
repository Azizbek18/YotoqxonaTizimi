import { NextRequest, NextResponse } from 'next/server'
import { createStaffAccountService } from '@/features/staff-accounts/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { staffFacultyOrPrimary } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'

function errorResponse(error: unknown) {
  console.error('Admin staff-accounts API error:', error)
  const response = getApiError(error, "So'rovni bajarib bo'lmadi")
  return NextResponse.json(response.body, { status: response.status })
}

// Read-only list of a faculty's tarbiyachi accounts. Open to dekan (their
// own faculty) and, during the admin -> dekan transition, admin (the
// primary building). Onboarding a new tarbiyachi goes through an
// email-bound invite code (/api/dekan/staff-invites + /api/staff/register),
// never a direct create here.
export async function GET(request: NextRequest) {
  try {
    const { staff: caller } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = staffFacultyOrPrimary(caller.faculty)
    return NextResponse.json({ staff: await createStaffAccountService().list(faculty) })
  } catch (error) {
    return errorResponse(error)
  }
}
