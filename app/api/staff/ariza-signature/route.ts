import { NextRequest, NextResponse } from 'next/server'
import { createApplicationService } from '@/features/applications/server/service'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

// Dekan / tarbiyachi / admin: the electronic-signature evidence for one
// application — verify code, time, typed name, IP/device, and whether the
// stored content still matches what was signed.
export async function GET(request: NextRequest) {
  try {
    await requireActiveStaff(request, ['dekan', 'admin', 'tarbiyachi'])
    const arizaId = request.nextUrl.searchParams.get('arizaId')
    const service = createApplicationService()
    // ?document=1 → the payload to regenerate the signed PDF.
    if (request.nextUrl.searchParams.get('document') === '1') {
      return NextResponse.json(await service.documentData(arizaId))
    }
    return NextResponse.json(await service.staffSignature(arizaId))
  } catch (error) {
    const r = getApiError(error, 'Imzo ma‘lumotini yuklab bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
