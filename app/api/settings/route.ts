import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/server/auth/guards'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    await requireUser(request)
    return NextResponse.json(await createAppSettingsService().get())
  } catch (error) {
    console.error('Settings GET error:', error)
    const response = getApiError(error, "Sozlamalarni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
