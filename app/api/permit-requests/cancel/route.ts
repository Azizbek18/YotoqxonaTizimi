import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { EMAIL_PROOF_REQUIRED, hasEmailProof, issueEmailChallenge } from '@/lib/email-proof'
import { domainAcceptsMail } from '@/lib/email-domain'
import { sendEmailVerificationCode } from '@/lib/email'
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

// Viewing an application's status needs no proof (see /api/permit-requests/
// status) — but CANCELLING one is destructive, so this still requires
// proving control of the inbox on file. Same two-step shape as status's
// identity-only lookup: no email in the request → find the record and mail
// the code to ITS on-file address; email + emailProof → actually cancel.
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
      emailProof?: unknown
    } | null
    const applicationType = body?.applicationType === 'imtiyozli' ? 'imtiyozli' : 'yollanma'
    const passport = applicationType === 'imtiyozli'
      ? normalizeForeignIdNumber(body?.passportSeries)
      : normalizePassport(body?.passportSeries)
    const jshshir = normalizeJshshir(body?.jshshir)

    const identityValid = applicationType === 'imtiyozli'
      ? isValidForeignIdNumber(passport)
      : isValidPassport(passport) && isValidJshshir(jshshir)
    if (!identityValid) {
      return NextResponse.json({
        error: applicationType === 'imtiyozli' ? 'Pasport/ID formati noto‘g‘ri.' : 'Pasport yoki JShSHIR formati noto‘g‘ri.',
      }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const identityQuery = () => {
      const q = supabase.from('permit_requests').select('id, email, status, permit_url, faculty')
        .eq('passport_series', passport)
        .eq('application_type', applicationType)
      return applicationType === 'imtiyozli' ? q.is('jshshir', null) : q.eq('jshshir', jshshir)
    }

    const { data: permit, error } = await identityQuery().maybeSingle()
    if (error) throw error
    if (!permit) {
      return NextResponse.json({ error: 'Bu ma’lumotlar bilan ariza topilmadi.' }, { status: 404 })
    }
    if (permit.status !== 'pending') {
      return NextResponse.json({
        error: "Bu arizani endi bekor qilib bo‘lmaydi — dekan uni allaqachon ko‘rib chiqqan.",
      }, { status: 409 })
    }

    const rawEmail = String(body?.email ?? '').trim().toLowerCase().slice(0, 254)

    // No email supplied yet — mail the code to the ON-FILE address, never
    // one the caller might type; nothing is deleted until it comes back.
    if (!rawEmail) {
      const codeThrottle = await checkRateLimit(`permit-cancel-code:${permit.id}`, 3, 10 * 60_000)
      if (!codeThrottle.allowed) {
        return NextResponse.json({ error: 'Kod juda ko‘p so‘raldi. Bir necha daqiqadan keyin qayta urinib ko‘ring.' }, { status: 429 })
      }
      const domain = permit.email.slice(permit.email.lastIndexOf('@') + 1)
      if (!(await domainAcceptsMail(domain))) {
        return NextResponse.json(
          { error: 'Arizangizda ko‘rsatilgan email manziliga xat yetkazib bo‘lmayapti. Fakultet dekanatiga murojaat qiling.' },
          { status: 502 },
        )
      }
      const { code, challenge } = issueEmailChallenge(permit.email)
      const sent = await sendEmailVerificationCode(permit.email, code)
      if (!sent.ok) {
        if (process.env.NODE_ENV !== 'production') {
          return NextResponse.json({ requiresEmailProof: true, challenge, devCode: code })
        }
        return NextResponse.json({ error: 'Kodni yuborib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.' }, { status: 502 })
      }
      return NextResponse.json({ requiresEmailProof: true, challenge })
    }

    // Email + proof supplied — confirm it matches this row's on-file address.
    if (!isValidEmail(rawEmail)) {
      return NextResponse.json({ error: 'Email formati noto‘g‘ri.' }, { status: 400 })
    }
    if (rawEmail !== permit.email || !hasEmailProof(body?.emailProof, rawEmail)) {
      return NextResponse.json(EMAIL_PROOF_REQUIRED, { status: 401 })
    }

    // The status check above and the DELETE below is the race guard: if the
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
