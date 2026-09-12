import { NextRequest, NextResponse } from 'next/server'
import { createPermissionsService } from '@/features/permissions/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'

// Handing out rights is the dekan's own job, so this endpoint is never
// opened to a tarbiyachi — otherwise one could grant themselves back what
// the dekan just took away.
const MANAGERS = ['dekan', 'admin'] as const

function errorResponse(error: unknown) {
  console.error('Dekan permissions API error:', error)
  const response = getApiError(error, "So'rovni bajarib bo'lmadi")
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, MANAGERS)
    const members = await createPermissionsService().listMembers(requirePickedFaculty(staff))
    return NextResponse.json({ members })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, MANAGERS)
    const body = await request.json().catch(() => null)
    const result = await createPermissionsService().update(requirePickedFaculty(staff), body)
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error)
  }
}
