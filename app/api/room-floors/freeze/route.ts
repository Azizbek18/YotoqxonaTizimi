import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { createRoomLayoutService } from '@/features/room-layout/server/service'
import { getApiError } from '@/server/http/api-error'

// Same role pair as /api/room-floors/generate: the dekan is the one who
// needs this day to day (ta'mirlash — renovation), and admin keeps parity
// as the account of last resort for room-layout upkeep — it no longer owns
// the 3D builder itself (that moved to dekan, see /api/dekan/room-layout).
export async function PATCH(request: NextRequest) {
  try {
    await requireActiveStaff(request, ['admin', 'dekan'])
    const body = await request.json()
    const result = await createRoomLayoutService().setFrozen(body?.roomNumber, body?.frozen, body?.reason)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Room freeze PATCH error:', error)
    const response = getApiError(error, "Xona holatini o'zgartirib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
