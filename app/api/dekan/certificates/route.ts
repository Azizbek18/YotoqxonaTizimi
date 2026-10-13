import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'
import { sendStudentTelegram } from '@/lib/student-telegram'
import { sendPushWithoutBreaking } from '@/lib/push-notifications'
import { notifyStudent } from '@/lib/notify-student'
import { createCertificatesService } from '@/features/certificates/server/service'

function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.meningyotoqxonam.uz').replace(/\/+$/, '')
  return `${base}${path}`
}

export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const requests = await createCertificatesService().listForFaculty(requirePickedFaculty(staff))
    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Dekan certificates GET error:', error)
    const r = getApiError(error, "So'rovlarni yuklab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const faculty = requirePickedFaculty(staff)
    const throttle = await checkRateLimit(`dekan-certificate:${staff.id}`, 60, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Noto'g'ri identifikator" }, { status: 400 })
    }
    const body = (await request.json().catch(() => null)) as { action?: unknown; note?: unknown } | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: "So'rov noto'g'ri" }, { status: 400 })
    }
    const { request: decided, studentId } = await createCertificatesService().decide(id, faculty, staff, body)

    // Natijani talabaga yetkazish — xabar yetmasa ham qaror saqlanib qoladi.
    const approved = decided.status === 'approved'
    const link = appUrl('/talaba/malumotnoma')
    try {
      await sendStudentTelegram(
        studentId,
        approved
          ? `✅ Ma'lumotnomangiz tasdiqlandi (${decided.number}).\n\nYuklab olish: ${link}`
          : `❌ Ma'lumotnoma so'rovingiz rad etildi.\nSabab: ${decided.decisionNote ?? '—'}\n\n${link}`,
      )
    } catch (error) {
      console.error('Certificate Telegram notice failed:', error)
    }
    await sendPushWithoutBreaking(() =>
      notifyStudent(studentId, {
        title: approved ? "Ma'lumotnoma tasdiqlandi ✅" : "Ma'lumotnoma rad etildi",
        body: approved ? 'PDF ni yuklab olishingiz mumkin.' : (decided.decisionNote ?? ''),
        url: '/talaba/malumotnoma',
        tag: `certificate-${id}`,
      }),
    )
    return NextResponse.json({ request: decided })
  } catch (error) {
    console.error('Dekan certificates PATCH error:', error)
    const r = getApiError(error, "Qarorni saqlab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
