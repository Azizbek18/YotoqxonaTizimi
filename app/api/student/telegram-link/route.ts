import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStudent } from '@/server/auth/guards'
import { getStudentTelegramLink } from '@/lib/student-telegram'
import { getApiError } from '@/server/http/api-error'

// The student's Telegram binding state + a fresh /start deep link if not
// linked. GET and POST behave the same (POST is used to (re)issue a link).
async function handle(request: NextRequest) {
  const { student } = await requireActiveStudent(request)
  return NextResponse.json(await getStudentTelegramLink(student.id))
}

export async function GET(request: NextRequest) {
  try {
    return await handle(request)
  } catch (error) {
    const r = getApiError(error, 'Telegram holatini yuklab bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    return await handle(request)
  } catch (error) {
    const r = getApiError(error, 'Telegram havolasini olishda xatolik')
    return NextResponse.json(r.body, { status: r.status })
  }
}
