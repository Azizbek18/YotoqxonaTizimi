import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/server/auth/guards'
import { createStaffInviteService } from '@/features/staff-invites/server/service'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'

// Superadmin-only: mint / list / revoke faculty-bound dean registration
// codes. Replaces the SSH-only scripts/mint-dekan-invite.mjs. The `admin`
// role is deliberately global here — a dean invite is issued for any
// faculty, not the caller's own.
function errorResponse(error: unknown) {
  console.error('Dean invites API error:', error)
  const response = getApiError(error, "So'rovni bajarib bo'lmadi")
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
    return NextResponse.json({ invites: await createStaffInviteService().listDeanInvites() })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user } = await requireAdmin(request)
    const throttle = await checkRateLimit(`dean-invite-create:${user.id}`, 15, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const invite = await createStaffInviteService().createDeanInvite(user.id, await request.json().catch(() => ({})))
    return NextResponse.json(invite, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request)
    const id = request.nextUrl.searchParams.get('id')
    return NextResponse.json(await createStaffInviteService().revokeDeanInvite(id))
  } catch (error) {
    return errorResponse(error)
  }
}
