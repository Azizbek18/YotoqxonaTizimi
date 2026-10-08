import { NextRequest, NextResponse } from 'next/server'
import { createFacultyStudentsService } from '@/features/faculty-students/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { requirePickedFaculty } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'

// Dekan/superadmin only (tarbiyachi can view students but not edit them).
export async function POST(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const faculty = requirePickedFaculty(staff)
    const throttle = await checkRateLimit(`dekan-email-change:${staff.id}`, 10, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const body = await request.json().catch(() => null)
    const result = await createFacultyStudentsService().changeEmail(faculty, body, staff.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Dekan email change API error:', error)
    const response = getApiError(error, "Emailni o'zgartirib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
