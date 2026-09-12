import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { sanitizePermissions } from '@/features/permissions/types'

/**
 * The caller's own revoked permissions, so their panel can hide the sections
 * the dekan closed instead of showing menu entries that answer 403.
 *
 * Read-only and self-scoped — it never reveals anyone else's rights, and the
 * server checks stay the real enforcement; this only keeps the UI honest.
 */
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['tarbiyachi', 'dekan', 'admin'])
    // Only a tarbiyachi actually carries revocations; a dekan/admin is the
    // one handing them out, so they always come back fully privileged.
    const permissions = staff.role === 'tarbiyachi'
      ? sanitizePermissions('tarbiyachi', staff.permissions)
      : {}
    return NextResponse.json({ role: staff.role, permissions })
  } catch (error) {
    const response = getApiError(error, "Ruxsatlarni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
