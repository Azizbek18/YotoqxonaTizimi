import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/server/auth/guards'
import { createRoomLayoutService } from '@/features/room-layout/server/service'
import { getApiError } from '@/server/http/api-error'

// Deliberately open to any signed-in user, unlike /api/dekan/room-layout:
// this returns only "which room is on which floor", which every role's UI
// has to render (a student's own floor, a dekan's floor filter). It carries
// no occupancy, no names and no layout geometry, so it needs no role gate
// beyond being authenticated.
export async function GET(request: NextRequest) {
  try {
    await requireUser(request)
    const rooms = await createRoomLayoutService().listRoomFloors()
    return NextResponse.json({ rooms })
  } catch (error) {
    console.error('Room floors GET error:', error)
    const response = getApiError(error, "Qavat ma'lumotini yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
