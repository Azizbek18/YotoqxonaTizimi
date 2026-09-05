import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { getApiError } from '@/server/http/api-error'

// The dekan edits their own faculty's dorm settings. staff.faculty is the
// authority here, exactly like /api/dekan/elonlar and /api/dekan/students.
export async function GET(request: NextRequest) {
  try {
    // Read-only for a tarbiyachi (their Sozlamalar shows the dorm/fee/
    // attendance config); the PUT stays dekan/admin.
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin', 'tarbiyachi'])
    // ?dormId= names a SPECIFIC one of the faculty's buildings
    // (202609300000) — omitted keeps resolving to the primary, unchanged.
    const dormId = request.nextUrl.searchParams.get('dormId') ?? undefined
    return NextResponse.json(await createAppSettingsService().get(requirePickedFaculty(staff), dormId))
  } catch (error) {
    console.error('Dekan settings GET error:', error)
    const response = getApiError(error, "Sozlamalarni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const body = await request.json()
    const dormId = typeof body?.dormId === 'string' ? body.dormId : undefined
    return NextResponse.json(await createAppSettingsService().update(body, requirePickedFaculty(staff), dormId))
  } catch (error) {
    console.error('Dekan settings PUT error:', error)
    const response = getApiError(error, "Sozlamalarni saqlab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
