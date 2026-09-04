import { NextRequest, NextResponse } from 'next/server'
import { createFacultyStudentsService } from '@/features/faculty-students/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

// ?scope=placed (default) | roomless | all — an unrecognised value falls
// back to 'placed' rather than widening the result set by accident.
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin', 'tarbiyachi'])
    const scope = request.nextUrl.searchParams.get('scope')
    const students = await createFacultyStudentsService().listStudents(staff.faculty, scope)
    return NextResponse.json({ students })
  } catch (error) {
    console.error('Dekan students directory API error:', error)
    const response = getApiError(error, "So'rovni bajarib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
