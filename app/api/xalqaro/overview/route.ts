import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'
import { createForeignDocsService } from '@/features/foreign-docs/server/service'

// International office: every foreign student across ALL faculties with their
// current visa and registration (propiska). Read-only by construction — this
// file exports GET only, and the service returns a deliberately narrow shape
// (no document scans, landlord details or notes). `admin` may also read it so
// the superadmin can see exactly what the office sees.
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['xalqaro', 'admin'])
    const throttle = await checkRateLimit(`xalqaro-overview:${staff.id}`, 30, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const students = await createForeignDocsService().listInternationalOverview()
    return NextResponse.json({ students })
  } catch (error) {
    console.error('Xalqaro overview GET error:', error)
    const r = getApiError(error, "Ma'lumotlarni yuklab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
