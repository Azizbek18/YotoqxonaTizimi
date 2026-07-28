import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/server/auth/guards'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await createAppSettingsService().get())
  } catch (error) {
    console.error('Admin settings GET error:', error)
    const response = getApiError(error, "Sozlamalarni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await request.json()
    return NextResponse.json(await createAppSettingsService().update(body))
  } catch (error) {
    console.error('Admin settings PUT error:', error)
    const response = getApiError(error, "Sozlamalarni saqlab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
