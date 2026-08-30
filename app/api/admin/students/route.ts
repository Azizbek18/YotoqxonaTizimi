import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/server/auth/guards'
import { createSuperadminStudentsService, parseStudentsQuery } from '@/features/superadmin-students/server/service'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'

// Superadmin cross-faculty student console. `admin` is global here — this is
// the sanctioned path for moving a student between faculties (which
// /api/admin/users deliberately refuses) and for expulsion.
function errorResponse(error: unknown) {
  console.error('Superadmin students API error:', error)
  const response = getApiError(error, "So'rovni bajarib bo'lmadi")
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    const query = parseStudentsQuery(request.nextUrl.searchParams)
    return NextResponse.json(await createSuperadminStudentsService().getPage(query))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { user } = await requireAdmin(request)
    const throttle = await checkRateLimit(`sa-student-action:${user.id}`, 30, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const service = createSuperadminStudentsService()
    const id = body.id

    switch (body.action) {
      case 'move':
        return NextResponse.json(await service.moveFaculty(id, body.faculty, user.id))
      case 'blacklist':
        return NextResponse.json(await service.setBlacklist(id, true, body.reason, user.id))
      case 'unblacklist':
        return NextResponse.json(await service.setBlacklist(id, false, body.reason, user.id))
      case 'expel':
        return NextResponse.json(await service.expel(id, body.reason, body.alsoBlacklist === true, user.id))
      default:
        return NextResponse.json({ error: "Amal noto'g'ri" }, { status: 400 })
    }
  } catch (error) {
    return errorResponse(error)
  }
}
