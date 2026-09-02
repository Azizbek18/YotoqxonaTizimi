import { NextRequest, NextResponse } from 'next/server'
import { createApplicationService } from '@/features/applications/server/service'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

// The data (composed fields + hand-drawn signature) to regenerate the
// student's own signed PDF.
export async function GET(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const id = request.nextUrl.searchParams.get('id')
    return NextResponse.json(await createApplicationService().documentData(id, { studentId: student.id }))
  } catch (error) {
    const r = getApiError(error, 'Hujjatni yuklab bo\'lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
