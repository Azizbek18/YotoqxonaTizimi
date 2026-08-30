import { NextRequest, NextResponse } from 'next/server'
import { createPermitAdminService } from '@/features/permits/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

function errorResponse(error: unknown) {
  console.error('Dekan overview API error:', error)
  const response = getApiError(error, 'Yo\'llanma so\'rovini bajarib bo\'lmadi')
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const service = createPermitAdminService()
    return NextResponse.json(
      staff.superadminGlobal ? await service.overviewGlobal() : await service.overview(staff.faculty),
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    // Approving/rejecting a permit is always a single-faculty action — a
    // superadmin picks the faculty first (or acts from that faculty's queue).
    if (staff.superadminGlobal) {
      return NextResponse.json({ error: 'Avval fakultetni tanlang', code: 'SCOPE_REQUIRED' }, { status: 400 })
    }
    return NextResponse.json(await createPermitAdminService().update(staff.faculty, await request.json(), staff.id))
  } catch (error) {
    return errorResponse(error)
  }
}
