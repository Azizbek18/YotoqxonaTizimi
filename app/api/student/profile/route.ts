import { NextRequest, NextResponse } from 'next/server'
import { createProfileService } from '@/features/profile/server/service'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    return NextResponse.json(await createProfileService().getProfile(student.id))
  } catch (error) {
    console.error('Profile GET error:', error)
    const response = getApiError(error, 'Profilni yuklab bo‘lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}
