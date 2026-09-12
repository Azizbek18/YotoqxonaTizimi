import { NextRequest, NextResponse } from 'next/server'
import { requireFloorCaptain } from '@/server/auth/sardor'
import { getApiError } from '@/server/http/api-error'
import { sanitizePermissions } from '@/features/permissions/types'

/**
 * The signed-in floor captain's own revoked permissions, so the sardor panel
 * can hide the sections the dekan closed instead of showing a tab that
 * answers 403 the moment it's opened.
 *
 * Read-only and self-scoped, like /api/staff/my-permissions for staff — the
 * server checks on each /api/sardor/* route stay the real enforcement, this
 * only keeps the UI honest. Ungated on purpose: a captain must always be
 * able to see their own rights, even once every one of them is revoked.
 */
export async function GET(request: NextRequest) {
  try {
    const scoped = await requireFloorCaptain(request)
    if (scoped.error) return scoped.error
    const permissions = sanitizePermissions('sardor', scoped.caller.captain_permissions)
    return NextResponse.json({ permissions })
  } catch (error) {
    const response = getApiError(error, "Ruxsatlarni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
