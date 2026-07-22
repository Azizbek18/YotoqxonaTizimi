import { NextRequest, NextResponse } from 'next/server'
import { createStaffAccountService } from '@/features/staff-accounts/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'

function errorResponse(error: unknown) {
  console.error('Zamdekan staff API error:', error)
  const response = getApiError(error, "So'rovni bajarib bo'lmadi")
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    await requireActiveStaff(request, ['zamdekan'])
    const staff = await createStaffAccountService().list()
    return NextResponse.json({ staff })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { staff: zamdekan } = await requireActiveStaff(request, ['zamdekan'])
    const throttle = await checkRateLimit(`zamdekan-staff-create:${zamdekan.id}`, 10, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const result = await createStaffAccountService().create(await request.json())
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
