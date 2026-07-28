import { NextRequest, NextResponse } from 'next/server'
import { createStaffAccountService } from '@/features/staff-accounts/server/service'
import { requireAdmin } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'

function errorResponse(error: unknown) {
  console.error('Admin staff-accounts API error:', error)
  const response = getApiError(error, "So'rovni bajarib bo'lmadi")
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const staff = await createStaffAccountService().list()
    return NextResponse.json({ staff })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { staff: admin } = await requireAdmin(request)
    const throttle = await checkRateLimit(`admin-staff-create:${admin.id}`, 10, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const result = await createStaffAccountService().create(admin.id, await request.json())
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
