import { NextRequest, NextResponse } from 'next/server'
import { createAdminDashboardService } from '@/features/admin-dashboard/server/service'
import { requireAdmin } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await createAdminDashboardService().get())
  } catch (error) {
    console.error('Admin dashboard GET error:', error)
    const response = getApiError(error, 'Dashboard ma\'lumotlarini yuklab bo\'lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}
