import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { createStaffInviteService } from '@/features/staff-invites/server/service'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'

function errorResponse(error: unknown) {
  console.error('Staff invites API error:', error)
  const response = getApiError(error, "So'rovni bajarib bo'lmadi")
  return NextResponse.json(response.body, { status: response.status })
}

// The dekan mints reusable, revocable invite codes for their own faculty's
// tarbiyachi (and co-dekan) accounts. admin is allowed during the
// transition and resolves to the primary building.
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = requirePickedFaculty(staff)
    return NextResponse.json({ invites: await createStaffInviteService().list(faculty) })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, staff } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = requirePickedFaculty(staff)
    const throttle = await checkRateLimit(`staff-invite-create:${user.id}`, 20, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const invite = await createStaffInviteService().create(user.id, faculty, await request.json().catch(() => ({})))
    return NextResponse.json(invite, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = requirePickedFaculty(staff)
    const id = request.nextUrl.searchParams.get('id')
    return NextResponse.json(await createStaffInviteService().revoke(faculty, id))
  } catch (error) {
    return errorResponse(error)
  }
}
