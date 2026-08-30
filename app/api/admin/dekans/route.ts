import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/server/auth/guards'
import { createSuperadminDekanService } from '@/features/superadmin-dekans/server/service'
import { getApiError } from '@/server/http/api-error'

// Global cross-faculty oversight. The caller's staff.faculty is deliberately
// irrelevant here: `admin` is the retained superadmin role, while `dekan`
// remains faculty-scoped everywhere else.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await createSuperadminDekanService().getOverview())
  } catch (error) {
    console.error('Superadmin dekans GET error:', error)
    const response = getApiError(error, "Dekanlar nazorat ma'lumotlarini yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}

// Dean lifecycle: { id, action: 'activate' | 'deactivate' | 'reassign', faculty? }
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = (await request.json().catch(() => ({}))) as {
      id?: unknown
      action?: unknown
      faculty?: unknown
    }
    const service = createSuperadminDekanService()

    if (body.action === 'activate') {
      return NextResponse.json(await service.setDekanStatus(body.id, 'active'))
    }
    if (body.action === 'deactivate') {
      return NextResponse.json(await service.setDekanStatus(body.id, 'inactive'))
    }
    if (body.action === 'reassign') {
      return NextResponse.json(await service.reassignDekan(body.id, body.faculty))
    }
    return NextResponse.json({ error: "Amal noto'g'ri" }, { status: 400 })
  } catch (error) {
    console.error('Superadmin dekans PATCH error:', error)
    const response = getApiError(error, "Dekan hisobini yangilab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
