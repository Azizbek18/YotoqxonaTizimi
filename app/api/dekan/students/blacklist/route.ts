import { NextRequest, NextResponse } from 'next/server'
import { createFacultyStudentsService } from '@/features/faculty-students/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'

export async function POST(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan'])
    // Barring a resident frees their bed and emails them — throttle it as
    // hard as a warning so a stuck UI can't fire it repeatedly.
    const throttle = await checkRateLimit(`dekan-blacklist:${staff.id}`, 10, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const body = await request.json().catch(() => null)
    const result = await createFacultyStudentsService().setBlacklist(staff.faculty, body, staff.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Dekan blacklist API error:', error)
    const response = getApiError(error, "Amalni bajarib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
