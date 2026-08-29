import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { requireStaffFaculty } from '@/server/auth/faculty'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { getApiError } from '@/server/http/api-error'

// The dekan edits their own faculty's dorm settings. staff.faculty is the
// authority here, exactly like /api/dekan/elonlar and /api/dekan/students.
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    return NextResponse.json(await createAppSettingsService().get(requireStaffFaculty(staff.faculty)))
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
    return NextResponse.json(await createAppSettingsService().update(body, requireStaffFaculty(staff.faculty)))
  } catch (error) {
    console.error('Dekan settings PUT error:', error)
    const response = getApiError(error, "Sozlamalarni saqlab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
