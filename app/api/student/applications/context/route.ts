import { NextRequest, NextResponse } from 'next/server'
import { createApplicationService } from '@/features/applications/server/service'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

// Prefill for the formal ariza composer preview (F.I.Sh, fakultet, kurs,
// TTJ raqami, xona, dekan ismi).
export async function GET(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    return NextResponse.json(await createApplicationService().arizaContext(student.id))
  } catch (error) {
    const r = getApiError(error, 'Ma\'lumotni yuklab bo\'lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
