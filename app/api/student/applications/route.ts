import { NextRequest, NextResponse } from 'next/server'
import { createApplicationService, type SignatureEvidence } from '@/features/applications/server/service'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit, getClientIp } from '@/lib/security'

function evidence(request: NextRequest): SignatureEvidence {
  return { ip: getClientIp(request) || null, userAgent: request.headers.get('user-agent') }
}

function errorResponse(error: unknown) {
  console.error('Student applications API error:', error)
  const response = getApiError(error, 'Murojaat so\'rovini bajarib bo\'lmadi')
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    return NextResponse.json(await createApplicationService().list(
      student.id,
      request.nextUrl.searchParams.get('kind'),
      request.nextUrl.searchParams.get('limit'),
    ))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const throttle = await checkRateLimit(`application-submit:${student.id}:${getClientIp(request)}`, 10, 15 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: 'Juda ko\'p urinish. Keyinroq qayta urinib ko\'ring.' }, { status: 429 })
    }
    return NextResponse.json(await createApplicationService().create(student.id, await request.json(), evidence(request)))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const body = await request.json().catch(() => ({}))
    return NextResponse.json(
      await createApplicationService().submit(student.id, body.id, body.signature, evidence(request)),
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    return NextResponse.json(await createApplicationService().remove(
      student.id,
      request.nextUrl.searchParams.get('id'),
    ))
  } catch (error) {
    return errorResponse(error)
  }
}
