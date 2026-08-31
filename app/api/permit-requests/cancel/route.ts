import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'
import {
  isValidEmail,
  isValidForeignIdNumber,
  isValidJshshir,
  isValidPassport,
  normalizeForeignIdNumber,
  normalizeJshshir,
  normalizePassport,
} from '@/lib/permit-validation'
import { writeAuditLog } from '@/lib/audit-log'

// A student who spots a mistake in a still-pending permit request can pull
// it back themselves. Identity is proven the same way as the status check
// (/api/permit-requests/status) — the passport/JShSHIR/email that keys the
// row. Only 'pending' rows can go: once a dekan has ruled on it, the
// decision (and any reserved room) stands.
export async function POST(request: NextRequest) {
  const throttle = await checkRateLimit(`permit-cancel:${getClientIp(request)}`, 6, 15 * 60_000)
  if (!throttle.allowed) {
    return NextResponse.json({ error: 'Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.' }, { status: 429 })
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      passportSeries?: unknown
      jshshir?: unknown
      email?: unknown
      applicationType?: unknown
    } | null
    const applicationType = body?.applicationType === 'imtiyozli' ? 'imtiyozli' : 'yollanma'
    const passport = applicationType === 'imtiyozli'
      ? normalizeForeignIdNumber(body?.passportSeries)
      : normalizePassport(body?.passportSeries)
    const jshshir = normalizeJshshir(body?.jshshir)
    const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 254)

    const identityValid = applicationType === 'imtiyozli'
      ? isValidForeignIdNumber(passport)
      : isValidPassport(passport) && isValidJshshir(jshshir)
    if (!identityValid || !isValidEmail(email)) {
      return NextResponse.json({
        error: applicationType === 'imtiyozli'
          ? 'Pasport/ID yoki email formati noto‘g‘ri.'
          : 'Pasport, JShSHIR yoki email formati noto‘g‘ri.',
      }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    let query = supabase
      .from('permit_requests')
      .select('id, status, permit_url, faculty')
      .eq('passport_series', passport)
      .eq('email', email)
      .eq('application_type', applicationType)
    query = applicationType === 'imtiyozli' ? query.is('jshshir', null) : query.eq('jshshir', jshshir)

    const { data: permit, error } = await query.maybeSingle()
    if (error) throw error
    if (!permit) {
      return NextResponse.json({ error: 'Bu ma’lumotlar bilan ariza topilmadi.' }, { status: 404 })
    }
    if (permit.status !== 'pending') {
      return NextResponse.json({
        error: "Bu arizani endi bekor qilib bo‘lmaydi — dekan uni allaqachon ko‘rib chiqqan.",
      }, { status: 409 })
    }

    // The status check between SELECT and DELETE is the race guard: if the
    // dekan rules on it in that gap, the DELETE matches no rows.
    const { data: deleted, error: deleteError } = await supabase
      .from('permit_requests')
      .delete()
      .eq('id', permit.id)
      .eq('status', 'pending')
      .select('id')
    if (deleteError) throw deleteError
    if (!deleted || deleted.length === 0) {
      return NextResponse.json({ error: 'Ariza holati o‘zgardi — sahifani yangilang.' }, { status: 409 })
    }

    // permit_telegram_links cascades with the row; the stored file does not.
    if (permit.permit_url) {
      await supabase.storage.from('permits').remove([permit.permit_url])
    }

    await writeAuditLog({
      eventType: applicationType === 'imtiyozli' ? 'imtiyozli_request.cancelled' : 'permit_request.cancelled',
      status: 'success',
      ipAddress: getClientIp(request),
      targetRole: 'talaba',
      details: { faculty: permit.faculty },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Permit cancellation failed:', error)
    return NextResponse.json({ error: 'Arizani bekor qilishda server xatoligi yuz berdi.' }, { status: 500 })
  }
}
