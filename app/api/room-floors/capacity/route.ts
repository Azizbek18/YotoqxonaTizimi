import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { createRoomLayoutService } from '@/features/room-layout/server/service'
import { getApiError } from '@/server/http/api-error'

// Sibling of /freeze and /generate — same role pair. Per-room bed-count
// override (2/3-person exception rooms). `{ roomNumbers: [...] }` is the
// bulk form used by the "whole floor" / "range" quick-set in the builder;
// `{ roomNumber }` is the single-room edit from the Xonalar xaritasi detail
// panel. `capacity: null` clears the override back to the dorm default.
export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = requirePickedFaculty(staff)
    const body = await request.json()

    const service = createRoomLayoutService()
    const result = Array.isArray(body?.roomNumbers)
      ? await service.bulkSetCapacity(faculty, body.roomNumbers, body?.capacity)
      : await service.setCapacity(faculty, body?.roomNumber, body?.capacity)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Room capacity PATCH error:', error)
    const response = getApiError(error, "Xona sig'imini o'zgartirib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
