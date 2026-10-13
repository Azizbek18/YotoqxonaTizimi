import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'
import { createCertificatesService } from '@/features/certificates/server/service'

export async function GET(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request, { allowBlacklisted: true })
    const requests = await createCertificatesService().listForStudent(student.id)
    return NextResponse.json({ requests })
  } catch (error) {
    console.error('Certificates GET error:', error)
    const r = getApiError(error, "So'rovlarni yuklab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const throttle = await checkRateLimit(`certificate-request:${student.id}`, 6, 10 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const body = (await request.json().catch(() => null)) as { purpose?: unknown; purposeNote?: unknown } | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: "So'rov noto'g'ri" }, { status: 400 })
    }
    const created = await createCertificatesService().request(student.id, body)
    return NextResponse.json({ request: created })
  } catch (error) {
    console.error('Certificates POST error:', error)
    const r = getApiError(error, "So'rovni yuborib bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
