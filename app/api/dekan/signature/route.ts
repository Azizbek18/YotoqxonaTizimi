import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { getServiceSupabase } from '@/lib/server-supabase'
import { getApiError } from '@/server/http/api-error'
import { isValidSignatureDataUrl, deliverPendingPermitDocumentsSafely } from '@/lib/permit-documents'

// The dekan's electronic signature — drawn once, auto-stamped onto every
// generated Ariza + Tilxat. Saving it also flushes any documents that were
// waiting on it (a room was assigned before the signature existed).

export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const { data, error } = await getServiceSupabase()
      .from('staff')
      .select('signature_image')
      .eq('id', staff.id)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json({ signatureImage: data?.signature_image ?? null })
  } catch (error) {
    const response = getApiError(error, "Imzoni yuklab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const body = await request.json().catch(() => null)
    const signatureImage = typeof body?.signatureImage === 'string' ? body.signatureImage : ''
    if (!isValidSignatureDataUrl(signatureImage)) {
      return NextResponse.json({ error: 'Imzo tasviri noto‘g‘ri.' }, { status: 400 })
    }

    const { error } = await getServiceSupabase()
      .from('staff')
      .update({ signature_image: signatureImage, updated_at: new Date().toISOString() })
      .eq('id', staff.id)
    if (error) throw error

    // Fire-and-forget: any approved-and-roomed permit that was deferred for
    // "no dekan signature" can now be generated + delivered.
    if (staff.faculty) void deliverPendingPermitDocumentsSafely(staff.faculty)

    return NextResponse.json({ ok: true })
  } catch (error) {
    const response = getApiError(error, "Imzoni saqlab bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['dekan', 'admin'])
    const { error } = await getServiceSupabase()
      .from('staff')
      .update({ signature_image: null, updated_at: new Date().toISOString() })
      .eq('id', staff.id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    const response = getApiError(error, "Imzoni o'chirib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
