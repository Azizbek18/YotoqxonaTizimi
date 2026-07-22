import { NextRequest, NextResponse } from 'next/server'
import { createAnnouncementService } from '@/features/announcements/server/service'
import { getRequestUser } from '@/lib/server-auth'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request)
    return NextResponse.json(await createAnnouncementService().listForUser(user?.id ?? null))
  } catch (error) {
    console.error('Elonlar GET xato:', error)
    const response = getApiError(error, "E'lonlarni yuklashda xatolik")
    return NextResponse.json(response.body, { status: response.status })
  }
}
