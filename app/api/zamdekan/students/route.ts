import { NextRequest, NextResponse } from 'next/server'
import { createRoomAssignmentService } from '@/features/room-assignment/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'

function errorResponse(error: unknown) {
  console.error('Zamdekan students API error:', error)
  const response = getApiError(error, "So'rovni bajarib bo'lmadi")
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['zamdekan'])
    const students = await createRoomAssignmentService().listStudents(staff.faculty)
    return NextResponse.json({ students })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['zamdekan'])
    const throttle = await checkRateLimit(`zamdekan-room-assign:${staff.id}`, 20, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const result = await createRoomAssignmentService().assignRoom(staff.faculty, await request.json())
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
