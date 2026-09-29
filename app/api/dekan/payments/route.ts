import { NextRequest, NextResponse } from 'next/server'
import { createPaymentService } from '@/features/payments/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'

// Payment review for the dekan — the same list / summary / approve-reject
// the tarbiyachi has at /api/tarbiyachi/payments, but scoped to the dekan's
// OWN faculty (a superadmin acts on the faculty they picked). The shared
// /dekan/tolovlar page picks this endpoint by URL prefix.
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const faculties = [requirePickedFaculty(staff)]
    const service = createPaymentService()
    if (request.nextUrl.searchParams.get('summary') === '1') {
      return NextResponse.json(await service.getSummary(faculties))
    }
    const studentId = request.nextUrl.searchParams.get('studentId')?.trim() || undefined
    if (studentId && !/^[0-9a-f-]{36}$/i.test(studentId)) {
      return NextResponse.json({ error: 'Talaba identifikatori noto‘g‘ri' }, { status: 400 })
    }
    return NextResponse.json({ payments: await service.listAll(faculties, studentId) })
  } catch (error) {
    console.error('Dekan payments GET error:', error)
    const response = getApiError(error, 'To‘lovlarni yuklab bo‘lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const faculties = [requirePickedFaculty(staff)]
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Noto‘g‘ri so‘rov' }, { status: 400 })
    return NextResponse.json(await createPaymentService().review(faculties, body))
  } catch (error) {
    console.error('Dekan payments PATCH error:', error)
    const response = getApiError(error, 'To‘lov holatini yangilab bo‘lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}
