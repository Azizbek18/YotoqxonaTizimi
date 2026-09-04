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
    // The dashboard / room map / 3D viewer all read this overview. A
    // tarbiyachi gets the same faculty-scoped snapshot (no superadmin
    // global branch — that only fires for role 'admin'); the PATCH that
    // decides a permit stays dekan/admin.
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin', 'tarbiyachi'])
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
    const body = await request.json()
    // A superadmin in global scope steps in for whichever faculty owns the
    // permit — the queue of a dean-less faculty would be stuck otherwise.
    if (staff.superadminGlobal) {
      return NextResponse.json(await createPermitAdminService().updateGlobal(body, staff.id))
    }
    return NextResponse.json(await createPermitAdminService().update(staff.faculty, body, staff.id))
  } catch (error) {
    return errorResponse(error)
  }
}
