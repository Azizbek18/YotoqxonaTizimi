import { NextRequest, NextResponse } from 'next/server'
import { createPaymentService } from '@/features/payments/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { staffDormFaculties } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'

// Payment review — the tarbiyachi's job. They are responsible for every
// student in their dorm building, across every faculty living there
// (shared-dorm tenancy, P4). The dekan gets a read-only view through
// /api/dekan/students/payments; approving/rejecting a receipt lives only
// here, scoped to the tarbiyachi's dorm faculties.
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['tarbiyachi'])
    const faculties = await staffDormFaculties(staff.id, staff.faculty)
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
    console.error('Admin payments GET error:', error)
    const response = getApiError(error, 'To‘lovlarni yuklab bo‘lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['tarbiyachi'])
    const faculties = await staffDormFaculties(staff.id, staff.faculty)
    const body = await request.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Noto‘g‘ri so‘rov' }, { status: 400 })
    return NextResponse.json(await createPaymentService().review(faculties, body))
  } catch (error) {
    console.error('Admin payments PATCH error:', error)
    const response = getApiError(error, 'To‘lov holatini yangilab bo‘lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}
