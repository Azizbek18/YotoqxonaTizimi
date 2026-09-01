import { NextRequest, NextResponse } from 'next/server'
import { createApplicationService } from '@/features/applications/server/service'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { getApiError } from '@/server/http/api-error'

// Public: enter a verify code from a tilxat, get back who signed which
// application and when, plus whether the stored content is intact. No PII
// beyond the signer's name and the document title.
export async function GET(request: NextRequest) {
  try {
    const throttle = await checkRateLimit(`ariza-verify:${getClientIp(request)}`, 20, 10 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Juda ko‘p urinish. Birozdan keyin qayta uring.' }, { status: 429 })
    }
    const code = request.nextUrl.searchParams.get('code')
    return NextResponse.json(await createApplicationService().verifyByCode(code))
  } catch (error) {
    const r = getApiError(error, 'Tekshirib bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
