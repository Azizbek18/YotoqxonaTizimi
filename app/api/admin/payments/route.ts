import { NextRequest, NextResponse } from 'next/server'
import { createPaymentService } from '@/features/payments/server/service'
import { requireAdmin } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const service = createPaymentService()
    if (request.nextUrl.searchParams.get('summary') === '1') {
      return NextResponse.json(await service.getSummary())
    }
    const studentId = request.nextUrl.searchParams.get('studentId')?.trim() || undefined
    if (studentId && !/^[0-9a-f-]{36}$/i.test(studentId)) {
      return NextResponse.json({ error: 'Talaba identifikatori noto‘g‘ri' }, { status: 400 })
    }
    return NextResponse.json({ payments: await service.listAll(studentId) })
  } catch (error) {
    console.error('Admin payments GET error:', error)
    const response = getApiError(error, 'To‘lovlarni yuklab bo‘lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request)
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Noto‘g‘ri so‘rov' }, { status: 400 })
    return NextResponse.json(await createPaymentService().review(body))
  } catch (error) {
    console.error('Admin payments PATCH error:', error)
    const response = getApiError(error, 'To‘lov holatini yangilab bo‘lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}
