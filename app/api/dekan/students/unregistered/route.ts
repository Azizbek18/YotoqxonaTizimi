import { NextRequest, NextResponse } from 'next/server'
import { createFacultyStudentsService } from '@/features/faculty-students/server/service'
import { requireActiveStaff, requireStaffPermission } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'

// Approved yo'llanma egalari, hali ro'yxatdan o'tmaganlar (xonasi bo'lishi
// ham, bo'lmasligi ham mumkin). Directory bilan bir xil ruxsat.
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin', 'tarbiyachi'])
    requireStaffPermission(staff, 'students.view')
    const students = await createFacultyStudentsService().listUnregistered(requirePickedFaculty(staff))
    return NextResponse.json({ students })
  } catch (error) {
    console.error('Dekan unregistered students API error:', error)
    const response = getApiError(error, "So'rovni bajarib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
