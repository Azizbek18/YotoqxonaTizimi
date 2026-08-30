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
