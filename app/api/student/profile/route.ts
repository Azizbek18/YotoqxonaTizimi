import { NextRequest, NextResponse } from 'next/server'
import { createProfileService } from '@/features/profile/server/service'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    // read-only: an expelled student still needs to see their own profile
    // (and the discipline / expulsion notice on /talaba/qoidalar)
    const { student } = await requireActiveStudent(request, { allowBlacklisted: true })
    return NextResponse.json(await createProfileService().getProfile(student.id))
  } catch (error) {
    console.error('Profile GET error:', error)
    const response = getApiError(error, 'Profilni yuklab bo‘lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}
