import { NextRequest, NextResponse } from 'next/server'
import { createProfileService } from '@/features/profile/server/service'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

export async function PATCH(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Noto‘g‘ri so‘rov' }, { status: 400 })
    return NextResponse.json(await createProfileService().update(student.id, body))
  } catch (error) {
    console.error('Profile PATCH error:', error)
    const response = getApiError(error, 'Profilni yangilab bo‘lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}
