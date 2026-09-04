import { NextRequest, NextResponse } from 'next/server'
import { createAnnouncementService } from '@/features/announcements/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'

function errorResponse(error: unknown, fallback: string) {
  console.error('Dekan announcements API error:', error)
  const response = getApiError(error, fallback)
  return NextResponse.json(response.body, { status: response.status })
}

// A tarbiyachi may write faculty announcements too, but only manage
// (edit / unpublish / delete) the ones they authored — a dekan manages
// every faculty announcement. `authorGuard` is the creator id to pin
// writes to, or undefined for a dekan/admin.
function authorGuard(staff: { role: string; id: string }) {
  return staff.role === 'tarbiyachi' ? staff.id : undefined
}

export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin', 'tarbiyachi'])
    const elonlar = await createAnnouncementService().listAuthored(staff.faculty)
    return NextResponse.json({ elonlar })
  } catch (error) {
    return errorResponse(error, "E'lonlarni yuklab bo'lmadi")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin', 'tarbiyachi'])
    const throttle = await checkRateLimit(`dekan-elon:${staff.id}`, 20, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const body = await request.json().catch(() => null)
    const elon = await createAnnouncementService().createForFaculty(staff.id, staff.faculty, body)
    return NextResponse.json({ elon }, { status: 201 })
  } catch (error) {
    return errorResponse(error, "E'lonni saqlab bo'lmadi")
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin', 'tarbiyachi'])
    const body = await request.json().catch(() => null)
    const elon = await createAnnouncementService().updateAuthored(staff.faculty, body, authorGuard(staff))
    return NextResponse.json({ elon })
  } catch (error) {
    return errorResponse(error, "E'lonni yangilab bo'lmadi")
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin', 'tarbiyachi'])
    const result = await createAnnouncementService().removeAuthored(
      staff.faculty,
      request.nextUrl.searchParams.get('id'),
      authorGuard(staff),
    )
    return NextResponse.json(result)
  } catch (error) {
    return errorResponse(error, "E'lonni o'chirib bo'lmadi")
  }
}
