import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/server/auth/guards'
import { createDataIntegrityService } from '@/features/data-integrity/server/service'
import { getApiError } from '@/server/http/api-error'

// Superadmin-only cross-faculty data-health scan. Read-only aggregation.
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await createDataIntegrityService().getReport())
  } catch (error) {
    console.error('Data integrity API error:', error)
    const response = getApiError(error, "Tekshiruvni bajarib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
