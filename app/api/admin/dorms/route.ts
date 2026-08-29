import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { createDormService } from '@/features/dorms/server/service'
import { getApiError } from '@/server/http/api-error'

// Superadmin (the retired `admin` role, kept for cross-faculty oversight):
// every dorm, its floor partition, its settings, plus direct floor
// arbitration. Dekans never reach this.
export async function GET(request: NextRequest) {
  try {
    await requireActiveStaff(request, ['admin'])
    return NextResponse.json({ dorms: await createDormService().listAll() })
  } catch (error) {
    console.error('Admin dorms GET error:', error)
    const r = getApiError(error, 'Yotoqxonalarni yuklab bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireActiveStaff(request, ['admin'])
    const body = await request.json().catch(() => null)
    await createDormService().create(body)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin dorms POST error:', error)
    const r = getApiError(error, 'Yotoqxona yaratib bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireActiveStaff(request, ['admin'])
    const body = await request.json().catch(() => null)
    const service = createDormService()
    const dormId = typeof body?.dormId === 'string' ? body.dormId : ''
    if (!dormId) return NextResponse.json({ error: 'Yotoqxona tanlanmagan' }, { status: 400 })

    if (body.action === 'reassignFloor') {
      const faculty = body.faculty === null ? null : String(body.faculty)
      await service.reassignFloor(dormId, Number(body.floor), faculty)
      return NextResponse.json({ ok: true })
    }
    await service.patchSettings(dormId, body.settings)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin dorms PATCH error:', error)
    const r = getApiError(error, 'Saqlab bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
