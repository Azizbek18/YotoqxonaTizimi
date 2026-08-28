import { NextRequest, NextResponse } from 'next/server'
import { createAdminDashboardService } from '@/features/admin-dashboard/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { staffFacultyOrPrimary } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'

// Dashboard stats. Open to dekan (their own faculty) and, during the
// admin -> dekan transition, admin (the primary building). Counts, the
// student list and the applications feed are all scoped to that faculty.
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan'])
    return NextResponse.json(await createAdminDashboardService().get(staffFacultyOrPrimary(staff.faculty)))
  } catch (error) {
    console.error('Admin dashboard GET error:', error)
    const response = getApiError(error, 'Dashboard ma\'lumotlarini yuklab bo\'lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}
