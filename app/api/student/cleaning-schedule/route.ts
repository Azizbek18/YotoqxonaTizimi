import { NextRequest, NextResponse } from 'next/server'
import { createCleaningScheduleService } from '@/features/duty/server/service'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

function errorResponse(error: unknown) {
  console.error('Cleaning schedule API error:', error)
  const response = getApiError(error, 'Navbatchilik jadvalini boshqarib bo\'lmadi')
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    return NextResponse.json(await createCleaningScheduleService().get(student.id))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const body = await request.json().catch(() => ({}))
    return NextResponse.json(await createCleaningScheduleService().save(student.id, body.schedule))
  } catch (error) {
    return errorResponse(error)
  }
}
