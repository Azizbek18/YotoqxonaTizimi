import { NextRequest, NextResponse } from 'next/server'
import { createApplicationService } from '@/features/applications/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { staffDormFaculties, staffFacultyOrPrimary } from '@/server/auth/faculty'

// Dekan / tarbiyachi / admin: the electronic-signature evidence for one
// application — verify code, time, typed name, IP/device, and whether the
// stored content still matches what was signed.
export async function GET(request: NextRequest) {
  try {
    const { user, staff } = await requireActiveStaff(request, ['dekan', 'admin', 'tarbiyachi'])
    // Same scope as the lists these ids come from: a tarbiyachi's whole
    // dorm, a dekan/admin their faculty, a global superadmin everything.
    const staffFaculties = staff.superadminGlobal
      ? null
      : staff.role === 'tarbiyachi'
        ? await staffDormFaculties(user.id, staff.faculty)
        : [staffFacultyOrPrimary(staff.faculty)]
    const arizaId = request.nextUrl.searchParams.get('arizaId')
    const service = createApplicationService()
    // ?document=1 → the payload to regenerate the signed PDF.
    if (request.nextUrl.searchParams.get('document') === '1') {
      return NextResponse.json(await service.documentData(arizaId, { staffFaculties }))
    }
    return NextResponse.json(await service.staffSignature(arizaId, staffFaculties))
  } catch (error) {
    const r = getApiError(error, 'Imzo ma‘lumotini yuklab bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
