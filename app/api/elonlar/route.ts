import { NextRequest, NextResponse } from 'next/server'
import { createAnnouncementService } from '@/features/announcements/server/service'
import { getRequestUser } from '@/lib/server-auth'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    // Internal dorm notices — signed-out callers would otherwise fall through
    // to the primary faculty's 'all'/'council' notices.
    const user = await getRequestUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi.' }, { status: 401 })
    }
    return NextResponse.json(await createAnnouncementService().listForUser(user.id))
  } catch (error) {
    console.error('Elonlar GET xato:', error)
    const response = getApiError(error, "E'lonlarni yuklashda xatolik")
    return NextResponse.json(response.body, { status: response.status })
  }
}
