import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'
import { createHomeLeaveService } from '@/features/home-leave/server/service'

export async function GET(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request, { allowBlacklisted: true })
    const leaves = await createHomeLeaveService().listForStudent(student.id)
    return NextResponse.json({ leaves })
  } catch (error) {
    console.error('Home leave GET error:', error)
    const r = getApiError(error, "Arizalarni yuklab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const throttle = await checkRateLimit(`home-leave:${student.id}`, 8, 10 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const body = await request.json().catch(() => null)
    const { leave, needsReview } = await createHomeLeaveService().create(student.id, body)
    return NextResponse.json({ leave, needsReview })
  } catch (error) {
    console.error('Home leave POST error:', error)
    const r = getApiError(error, "Arizani yuborib bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
