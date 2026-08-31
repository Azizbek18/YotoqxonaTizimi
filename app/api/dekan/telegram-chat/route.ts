import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { getDekanTelegramChatId, normalizeDekanChatId, setDekanTelegramChatId } from '@/lib/dekan-telegram'
import { ApiError, getApiError } from '@/server/http/api-error'

// The dekan configures the Telegram chat that receives a heads-up for each
// new permit request in their own faculty. staff.faculty is the authority,
// exactly like /api/dekan/settings.
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const chatId = await getDekanTelegramChatId(requirePickedFaculty(staff))
    return NextResponse.json({ chatId })
  } catch (error) {
    console.error('Dekan telegram-chat GET error:', error)
    const response = getApiError(error, "Telegram sozlamasini yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const body = (await request.json()) as { chatId?: unknown }
    const raw = typeof body?.chatId === 'string' ? body.chatId.trim() : ''
    if (raw && !normalizeDekanChatId(raw)) {
      throw new ApiError(400, "Telegram chat ID noto'g'ri — guruh raqami (masalan -1001234567890) yoki @kanal bo'lishi kerak")
    }
    const chatId = await setDekanTelegramChatId(requirePickedFaculty(staff), raw)
    return NextResponse.json({ chatId })
  } catch (error) {
    console.error('Dekan telegram-chat PUT error:', error)
    const response = getApiError(error, "Telegram sozlamasini saqlab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
