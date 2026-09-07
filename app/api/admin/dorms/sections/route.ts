import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { createDormService } from '@/features/dorms/server/service'
import { getApiError } from '@/server/http/api-error'

// Superadmin only: the A/B section ownership grid of a blocked-layout dorm
// (6-yotoqxona) and the actions that manage it — build the room template,
// hand a section to a faculty, take it back.

export async function GET(request: NextRequest) {
  try {
    await requireActiveStaff(request, ['admin'])
    const dormId = request.nextUrl.searchParams.get('dormId') ?? ''
    if (!dormId) return NextResponse.json({ error: 'Yotoqxona tanlanmagan' }, { status: 400 })
    return NextResponse.json({ grid: await createDormService().blockedGrid(dormId) })
  } catch (error) {
    console.error('Admin dorm sections GET error:', error)
    const r = getApiError(error, 'Seksiyalarni yuklab bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin'])
    const body = await request.json().catch(() => null)
    const service = createDormService()

    switch (body?.action) {
      case 'buildLayout': {
        const dormId = typeof body?.dormId === 'string' ? body.dormId : ''
        if (!dormId) return NextResponse.json({ error: 'Yotoqxona tanlanmagan' }, { status: 400 })
        return NextResponse.json({ ok: true, ...(await service.buildBlockedLayout(dormId)) })
      }
      case 'assignSection':
        return NextResponse.json({ ok: true, ...(await service.assignSection(body, staff.id)) })
      case 'clearSection':
        return NextResponse.json({ ok: true, ...(await service.clearSection(body)) })
      default:
        return NextResponse.json({ error: 'Noma’lum amal' }, { status: 400 })
    }
  } catch (error) {
    console.error('Admin dorm sections POST error:', error)
    const r = getApiError(error, 'Saqlab bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
