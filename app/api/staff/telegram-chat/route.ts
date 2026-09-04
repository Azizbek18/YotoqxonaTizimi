import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { getStaffTelegramChatId, normalizeStaffChatId, setStaffTelegramChatId } from '@/lib/staff-telegram'
import { ApiError, getApiError } from '@/server/http/api-error'

// Any staff member's PERSONAL Telegram chat — always keyed to the caller's
// own id, never a faculty. A tarbiyachi manages this from
// /tarbiyachi/sozlamalar; it is where "a student in your dorm filed an
// ariza" pings land.
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireActiveStaff(request, ['tarbiyachi', 'dekan', 'admin'])
    return NextResponse.json({ chatId: await getStaffTelegramChatId(user.id) })
  } catch (error) {
    console.error('Staff telegram-chat GET error:', error)
    const response = getApiError(error, "Telegram sozlamasini yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { user } = await requireActiveStaff(request, ['tarbiyachi', 'dekan', 'admin'])
    const body = (await request.json()) as { chatId?: unknown }
    const raw = typeof body?.chatId === 'string' ? body.chatId.trim() : ''
    if (raw && !normalizeStaffChatId(raw)) {
      throw new ApiError(400, "Telegram chat ID noto'g'ri — raqam (masalan 123456789) yoki @kanal bo'lishi kerak")
    }
    return NextResponse.json({ chatId: await setStaffTelegramChatId(user.id, raw) })
  } catch (error) {
    console.error('Staff telegram-chat PUT error:', error)
    const response = getApiError(error, "Telegram sozlamasini saqlab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
