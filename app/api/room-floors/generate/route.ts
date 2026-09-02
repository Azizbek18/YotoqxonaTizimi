import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { createRoomLayoutService } from '@/features/room-layout/server/service'
import { getApiError } from '@/server/http/api-error'

// Open to dekan as well as admin: the dekan is the one blocked by an empty
// room map (they can't place anyone until rooms exist), so they own it.
// The service makes each floor match its "nechta xona" target — appending
// new rooms, or deleting the excess EMPTY ones (an occupied room is never
// touched). See generateFloors.
export async function POST(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = requirePickedFaculty(staff)
    const body = await request.json()
    const result = await createRoomLayoutService().generateFloors(faculty, body?.floors, body?.numbering)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Room floors generate error:', error)
    const response = getApiError(error, "Xonalarni yaratib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
