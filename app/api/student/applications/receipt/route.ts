import { NextRequest, NextResponse } from 'next/server'
import { createApplicationService } from '@/features/applications/server/service'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

// The student re-opens the electronic receipt ("tilxat") for one of their
// signed applications.
export async function GET(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const id = request.nextUrl.searchParams.get('id')
    return NextResponse.json(await createApplicationService().receipt(student.id, id))
  } catch (error) {
    const r = getApiError(error, 'Tilxatni yuklab bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
