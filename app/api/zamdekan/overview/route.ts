import { NextRequest, NextResponse } from 'next/server'
import { createPermitAdminService } from '@/features/permits/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

function errorResponse(error: unknown) {
  console.error('Zamdekan overview API error:', error)
  const response = getApiError(error, 'Yo\'llanma so\'rovini bajarib bo\'lmadi')
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['zamdekan'])
    return NextResponse.json(await createPermitAdminService().overview(staff.faculty))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['zamdekan'])
    return NextResponse.json(await createPermitAdminService().update(staff.faculty, await request.json()))
  } catch (error) {
    return errorResponse(error)
  }
}
