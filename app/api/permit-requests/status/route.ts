import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'
import {
  isValidForeignIdNumber,
  isValidJshshir,
  isValidPassport,
  normalizeForeignIdNumber,
  normalizeJshshir,
  normalizePassport,
} from '@/lib/permit-validation'
import { issuePermitTelegramLinkSafely } from '@/lib/permit-telegram'

// Read-only: the applicant's own passport + JShSHIR is enough to see their
// application's status. This used to also demand proof of the on-file email
// (a code first) — dropped because the dekan reviews every submission by
// hand anyway, and the code step was mailing (and failing to deliver) far
// more often than it was catching anything. Actions that CHANGE the row —
// cancel (/api/permit-requests/cancel), edit, register — still require it.
export async function POST(request: NextRequest) {
  const throttle = await checkRateLimit(`permit-status:${getClientIp(request)}`, 15, 10 * 60_000)
  if (!throttle.allowed) {
    return NextResponse.json({ error: 'Juda ko‘p qidiruv amalga oshirildi.' }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => null) as {
      passportSeries?: unknown
      jshshir?: unknown
      applicationType?: unknown
    } | null
    const applicationType = body?.applicationType === 'imtiyozli' ? 'imtiyozli' : 'yollanma'
    const passport = applicationType === 'imtiyozli'
      ? normalizeForeignIdNumber(body?.passportSeries)
      : normalizePassport(body?.passportSeries)
    const jshshir = normalizeJshshir(body?.jshshir)
    const identityIsValid = applicationType === 'imtiyozli'
      ? isValidForeignIdNumber(passport)
      : isValidPassport(passport) && isValidJshshir(jshshir)
    if (!identityIsValid) {
      return NextResponse.json({
        error: applicationType === 'imtiyozli' ? 'Pasport/ID formati noto‘g‘ri.' : 'Pasport yoki JShSHIR formati noto‘g‘ri.',
      }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    let query = supabase
      .from('permit_requests')
      .select('id, email, full_name, status, room_number, reject_reason, blocked, created_at, faculty, phone, gender, direction, course, application_type, relative_phone, study_type, origin_country, origin_region')
      .eq('passport_series', passport)
      .eq('application_type', applicationType)
    query = applicationType === 'imtiyozli' ? query.is('jshshir', null) : query.eq('jshshir', jshshir)

    const { data, error } = await query.maybeSingle()
    if (error) throw error

    if (!data) {
      return NextResponse.json({ data: null })
    }

    // Queue position only means anything while still pending — approved/
    // rejected/registered are already out of the queue. Scoped to the same
    // faculty (that's the pool one dekan actually works through) and
    // ordered by submission time: how many pending arizalar were submitted
    // strictly before this one, +1 for this one's own place.
    let queuePosition: number | undefined
    let queueTotal: number | undefined
    if (data.status === 'pending') {
      const [{ count: ahead, error: aheadError }, { count: total, error: totalError }] = await Promise.all([
        supabase.from('permit_requests').select('id', { count: 'exact', head: true })
          .eq('faculty', data.faculty).eq('status', 'pending').lt('created_at', data.created_at),
        supabase.from('permit_requests').select('id', { count: 'exact', head: true })
          .eq('faculty', data.faculty).eq('status', 'pending'),
      ])
      if (aheadError) throw aheadError
      if (totalError) throw totalError
      queuePosition = (ahead ?? 0) + 1
      queueTotal = total ?? 0
    }

    // Whitelist the fields the applicant's own status check actually needs,
    // rather than forwarding the raw row. Everything past application_type
    // is the applicant's own submitted data — email included, now that
    // reaching this far only takes the passport + JShSHIR they submitted it
    // with: /register prefills the signup wizard from it, and the status
    // page prefills the submit form when the applicant pulls a pending
    // request back to edit it.
    const telegram = await issuePermitTelegramLinkSafely(data.id)
    return NextResponse.json({
      data: {
        id: data.id,
        full_name: data.full_name,
        email: data.email,
        status: data.status,
        room_number: data.room_number,
        reject_reason: data.reject_reason,
        blocked: Boolean(data.blocked),
        created_at: data.created_at,
        phone: data.phone,
        gender: data.gender,
        faculty: data.faculty,
        direction: data.direction,
        course: data.course,
        application_type: data.application_type,
        relative_phone: data.relative_phone,
        study_type: data.study_type,
        origin_country: data.origin_country,
        origin_region: data.origin_region,
        queuePosition,
        queueTotal,
        telegram,
      },
    })
  } catch (error) {
    console.error('Permit status lookup failed:', error)
    return NextResponse.json({ error: 'Holatni tekshirishda server xatoligi yuz berdi.' }, { status: 500 })
  }
}
