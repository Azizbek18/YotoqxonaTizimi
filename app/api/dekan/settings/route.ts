import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { normalizeFaculty } from '@/lib/faculties'
import { ApiError, getApiError } from '@/server/http/api-error'

// The dekan edits their own faculty's dorm settings. staff.faculty is the
// authority here, exactly like /api/dekan/elonlar and /api/dekan/students.
function dekanFaculty(faculty: string | null): string {
  const canonical = normalizeFaculty(faculty)
  if (!canonical) throw new ApiError(403, 'Dekan fakulteti biriktirilmagan')
  return canonical
}

export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan'])
    return NextResponse.json(await createAppSettingsService().get(dekanFaculty(staff.faculty)))
  } catch (error) {
    console.error('Dekan settings GET error:', error)
    const response = getApiError(error, "Sozlamalarni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan'])
    const body = await request.json()
    return NextResponse.json(await createAppSettingsService().update(body, dekanFaculty(staff.faculty)))
  } catch (error) {
    console.error('Dekan settings PUT error:', error)
    const response = getApiError(error, "Sozlamalarni saqlab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
