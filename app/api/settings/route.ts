import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/server/auth/guards'
import { resolveCallerFaculty } from '@/server/auth/faculty'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request)
    const faculty = await resolveCallerFaculty(user.id)
    return NextResponse.json(await createAppSettingsService().get(faculty), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    console.error('Settings GET error:', error)
    const response = getApiError(error, "Sozlamalarni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
