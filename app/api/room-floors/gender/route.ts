import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { createRoomLayoutService } from '@/features/room-layout/server/service'
import { getApiError } from '@/server/http/api-error'

// Sibling of /capacity and /freeze — same role pair. Declared room gender:
// the dekan reserves a room for boys/girls straight from the Xonalar
// xaritasi, before any student is placed. `{ roomNumbers: [...] }` is the
// bulk form (the map's multi-select mode); `{ roomNumber }` is the single
// edit from the detail panel. `gender: null` clears the reservation.
export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = requirePickedFaculty(staff)
    const body = await request.json()
    const dormId = typeof body?.dormId === 'string' ? body.dormId : undefined

    const service = createRoomLayoutService()
    const result = Array.isArray(body?.roomNumbers)
      ? await service.bulkSetGender(faculty, body.roomNumbers, body?.gender, dormId)
      : await service.setGender(faculty, body?.roomNumber, body?.gender, dormId)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Room gender PATCH error:', error)
    const response = getApiError(error, "Xona jinsini o'zgartirib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
