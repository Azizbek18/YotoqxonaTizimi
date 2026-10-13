import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'
import { createHomeLeaveService } from '@/features/home-leave/server/service'

type Params = { params: Promise<{ id: string }> }

/** Talaba o'z arizasini bekor qiladi, qaytganini bildiradi yoki (ixtiyoriy) joylashuvini yuboradi. */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { student } = await requireActiveStudent(request, { allowBlacklisted: true })
    const { id } = await params
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Noto'g'ri identifikator" }, { status: 400 })
    }
    const throttle = await checkRateLimit(`home-leave-patch:${student.id}`, 20, 10 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const body = (await request.json().catch(() => null)) as { action?: unknown; lat?: unknown; lng?: unknown } | null
    const service = createHomeLeaveService()
    if (body?.action === 'cancel' || body?.action === 'return') {
      const leave = await service.finish(student.id, id, body.action)
      return NextResponse.json({ leave })
    }
    if (body?.action === 'location') {
      return NextResponse.json({ leave: await service.shareLocation(student.id, id, body) })
    }
    return NextResponse.json({ error: "Amal noto'g'ri" }, { status: 400 })
  } catch (error) {
    console.error('Home leave PATCH error:', error)
    const r = getApiError(error, "Arizani yangilab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
