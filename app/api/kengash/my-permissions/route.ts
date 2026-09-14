import { NextRequest, NextResponse } from 'next/server'
import { requireCouncilChair } from '@/server/auth/council'
import { getApiError } from '@/server/http/api-error'
import { sanitizePermissions } from '@/features/permissions/types'

/**
 * The signed-in council chair's own revoked permissions, so their panel can
 * hide the sections the dekan closed instead of showing a tab that answers
 * 403 the moment it's opened.
 *
 * Read-only and self-scoped, like /api/sardor/my-permissions and
 * /api/staff/my-permissions. Ungated on purpose: a raisi must always be able
 * to see their own rights, even once every one of them is revoked.
 */
export async function GET(request: NextRequest) {
  try {
    const scoped = await requireCouncilChair(request)
    if (scoped.error) return scoped.error
    const permissions = sanitizePermissions('raisi', scoped.caller.council_chair_permissions)
    return NextResponse.json({ permissions })
  } catch (error) {
    const response = getApiError(error, "Ruxsatlarni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
