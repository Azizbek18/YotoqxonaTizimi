import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { createDormService } from '@/features/dorms/server/service'
import { getApiError } from '@/server/http/api-error'

// The blocked-layout dorm (7-yotoqxona) rooms this dekan's faculty owns —
// grouped by building → section (block + floor) → the fixed 9 rooms, each
// with its occupants. Placement itself goes through PATCH /api/dekan/students
// (assignRoom already takes block + floor + dormId).
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin', 'tarbiyachi'])
    const dorms = await createDormService().blockedRoomMap(staff.faculty ?? '')
    return NextResponse.json({ dorms })
  } catch (error) {
    console.error('Dekan blok-xonalar GET error:', error)
    const r = getApiError(error, "Blok xonalarini yuklab bo‘lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
