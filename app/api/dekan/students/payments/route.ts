import { NextRequest, NextResponse } from 'next/server'
import { createFacultyStudentsService } from '@/features/faculty-students/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

// Read-only by design: the dekan sees who has paid and who is in debt,
// but approving/rejecting a receipt stays with the admin (/api/admin/payments).
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan'])
    const payments = await createFacultyStudentsService().listPayments(staff.faculty)
    return NextResponse.json({ payments })
  } catch (error) {
    console.error('Dekan payments API error:', error)
    const response = getApiError(error, "To'lovlarni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
