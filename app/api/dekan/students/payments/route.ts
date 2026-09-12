import { NextRequest, NextResponse } from 'next/server'
import { createFacultyStudentsService } from '@/features/faculty-students/server/service'
import { requireActiveStaff, requireStaffPermission } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'

// Read-only by design: the dekan sees who has paid and who is in debt,
// but approving/rejecting a receipt stays with the admin (/api/tarbiyachi/payments).
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin', 'tarbiyachi'])
    requireStaffPermission(staff, 'payments.review')
    const payments = await createFacultyStudentsService().listPayments(requirePickedFaculty(staff))
    return NextResponse.json({ payments })
  } catch (error) {
    console.error('Dekan payments API error:', error)
    const response = getApiError(error, "To'lovlarni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
