import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'
import { sendStudentTelegram } from '@/lib/student-telegram'
import { sendPushWithoutBreaking } from '@/lib/push-notifications'
import { notifyStudent } from '@/lib/notify-student'
import { createHomeLeaveService } from '@/features/home-leave/server/service'

function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://www.meningyotoqxonam.uz').replace(/\/+$/, '')
  return `${base}${path}`
}

export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const faculty = requirePickedFaculty(staff)
    const service = createHomeLeaveService()
    const [leaves, overdue] = await Promise.all([service.listForFaculty(faculty), service.findOverdue(faculty)])
    return NextResponse.json({ leaves, overdue })
  } catch (error) {
    console.error('Dekan home leaves GET error:', error)
    const r = getApiError(error, "Arizalarni yuklab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const faculty = requirePickedFaculty(staff)
    const throttle = await checkRateLimit(`dekan-home-leave:${staff.id}`, 60, 60_000)
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
    const { leave, studentId } = await createHomeLeaveService().decide(id, faculty, staff, body)

    const approved = leave.status === 'active'
    const link = appUrl('/talaba/uyga-ketish')
    try {
      await sendStudentTelegram(
        studentId,
        approved
          ? `✅ Uyga ketish arizangiz tasdiqlandi (${leave.startsOn} — ${leave.endsOn}).\n\n${link}`
          : `❌ Uyga ketish arizangiz rad etildi.\nSabab: ${leave.decisionNote ?? '—'}\n\n${link}`,
      )
    } catch (error) {
      console.error('Home leave Telegram notice failed:', error)
    }
    await sendPushWithoutBreaking(() =>
      notifyStudent(studentId, {
        title: approved ? 'Uyga ketish arizasi tasdiqlandi ✅' : 'Uyga ketish arizasi rad etildi',
        body: approved ? `${leave.startsOn} — ${leave.endsOn}` : (leave.decisionNote ?? ''),
        url: '/talaba/uyga-ketish',
        tag: `home-leave-${id}`,
      }),
    )
    return NextResponse.json({ leave })
  } catch (error) {
    console.error('Dekan home leaves PATCH error:', error)
    const r = getApiError(error, "Qarorni saqlab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
