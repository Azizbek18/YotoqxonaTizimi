import { NextRequest, NextResponse } from 'next/server'
import { createPaymentService } from '@/features/payments/server/service'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const payments = await createPaymentService().listForStudent(student.id)
    return NextResponse.json({ payments })
  } catch (error) {
    console.error('Student payments GET error:', error)
    const response = getApiError(error, 'To‘lovlarni yuklab bo‘lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const throttle = await checkRateLimit(`payment-submit:${student.id}:${getClientIp(request)}`, 8, 15 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Juda ko‘p urinish' }, { status: 429 })
    }

    const result = await createPaymentService().submit(student, await request.formData())
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Student payments POST error:', error)
    const response = getApiError(error, 'To‘lovni saqlashda server xatoligi')
    return NextResponse.json(response.body, { status: response.status })
  }
}
