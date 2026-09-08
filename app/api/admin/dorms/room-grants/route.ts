import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { createDormService } from '@/features/dorms/server/service'
import { getApiError } from '@/server/http/api-error'

// Superadmin only: room-level faculty exceptions for a 'simple' shared dorm.
// A grant hands one room on another faculty's floor to a faculty, so a floor
// can be split room by room (e.g. AMIT's few rooms on ozbek-fil's floor 2).
export async function GET(request: NextRequest) {
  try {
    await requireActiveStaff(request, ['admin'])
    const dormId = request.nextUrl.searchParams.get('dormId') ?? ''
    if (!dormId) return NextResponse.json({ error: 'Yotoqxona tanlanmagan' }, { status: 400 })
    return NextResponse.json({ grid: await createDormService().roomGrantGrid(dormId) })
  } catch (error) {
    console.error('Admin room-grants GET error:', error)
    const r = getApiError(error, 'Xona istisnolarini yuklab bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin'])
    const body = await request.json().catch(() => null)
    const service = createDormService()
    switch (body?.action) {
      case 'grant':
        return NextResponse.json({ ok: true, ...(await service.grantRoom(body, staff.id)) })
      case 'ungrant':
        return NextResponse.json({ ok: true, ...(await service.ungrantRoom(body)) })
      default:
        return NextResponse.json({ error: 'Noma’lum amal' }, { status: 400 })
    }
  } catch (error) {
    console.error('Admin room-grants POST error:', error)
    const r = getApiError(error, 'Saqlab bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
