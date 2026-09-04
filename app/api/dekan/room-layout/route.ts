import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { createRoomLayoutService } from '@/features/room-layout/server/service'
import { getApiError } from '@/server/http/api-error'

// The 3D floor-plan builder (block-by-block room editor + Three.js
// preview) moved here from /api/admin/room-layout. Editing (PUT) is
// dekan-only; the GET is also read by the tarbiyachi panel's view-only 3D
// viewer. Scoped to the caller's own faculty building.
function errorResponse(error: unknown) {
  console.error('Room layout API error:', error)
  const response = getApiError(error, "So'rovni bajarib bo'lmadi")
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin', 'tarbiyachi'])
    const faculty = requirePickedFaculty(staff)

    const floor = request.nextUrl.searchParams.get('floor')
    const dormId = request.nextUrl.searchParams.get('dormId') ?? undefined
    const blocks = await createRoomLayoutService().getFloor(faculty, floor, dormId)
    return NextResponse.json({ blocks })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const faculty = requirePickedFaculty(staff)

    const body = await request.json()
    const dormId = typeof body?.dormId === 'string' ? body.dormId : undefined
    const result = await createRoomLayoutService().saveFloor(faculty, body?.floorNumber, body?.blocks, dormId)
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
