import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/server-admin'
import { createRoomLayoutService } from '@/features/room-layout/server/service'
import { getApiError } from '@/server/http/api-error'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function errorResponse(error: unknown) {
  console.error('Room layout API error:', error)
  const response = getApiError(error, "So'rovni bajarib bo'lmadi")
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    const { session, isAdmin } = await getAdminSession()
    if (!session?.user?.id) return jsonError('Autentifikatsiya talab qilinadi', 401)
    if (!isAdmin) return jsonError('Admin huquqi talab qilinadi', 403)

    const floor = request.nextUrl.searchParams.get('floor')
    const blocks = await createRoomLayoutService().getFloor(floor)
    return NextResponse.json({ blocks })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { session, isAdmin } = await getAdminSession()
    if (!session?.user?.id) return jsonError('Autentifikatsiya talab qilinadi', 401)
    if (!isAdmin) return jsonError('Admin huquqi talab qilinadi', 403)

    const body = await request.json()
    const result = await createRoomLayoutService().saveFloor(body?.floorNumber, body?.blocks)
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
