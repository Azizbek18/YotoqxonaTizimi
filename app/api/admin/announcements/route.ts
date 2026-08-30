import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/server/auth/guards'
import { createAnnouncementService } from '@/features/announcements/server/service'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'

// Superadmin-only: tizim-wide announcements (audience='system') — one notice
// that every student sees regardless of faculty. `admin` is global here.
function errorResponse(error: unknown) {
  console.error('System announcements API error:', error)
  const response = getApiError(error, "So'rovni bajarib bo'lmadi")
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json({ elonlar: await createAnnouncementService().listSystem() })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdmin(request)
    const throttle = await checkRateLimit(`sys-announcement:${user.id}`, 20, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const elon = await createAnnouncementService().createSystem(user.id, await request.json().catch(() => ({})))
    return NextResponse.json({ elon }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin(request)
    const elon = await createAnnouncementService().updateSystem(await request.json().catch(() => ({})))
    return NextResponse.json({ elon })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json(await createAnnouncementService().removeSystem(request.nextUrl.searchParams.get('id')))
  } catch (error) {
    return errorResponse(error)
  }
}
