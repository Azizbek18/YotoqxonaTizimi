import { NextRequest, NextResponse } from 'next/server'
import { createPermitAdminService } from '@/features/permits/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

// The pending badge + bell list only. `/api/dekan/overview` answers the same
// two fields, but it loads every permit and every student row of the faculty
// to do it — fine for the dashboard, ruinous for a 45s background poll on a
// Hobby compute budget. Same guard and same faculty scoping as overview.
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin', 'tarbiyachi'])
    return NextResponse.json(
      await createPermitAdminService().pendingSummary({
        faculty: staff.faculty,
        global: Boolean(staff.superadminGlobal),
      }),
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    console.error('Dekan pending-count API error:', error)
    const response = getApiError(error, "Kutilayotgan arizalarni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
