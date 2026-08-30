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

export async function POST(request: NextRequest) {
  const throttle = await checkRateLimit(`permit-status:${getClientIp(request)}`, 15, 10 * 60_000)
  if (!throttle.allowed) {
    return NextResponse.json({ error: 'Juda ko‘p qidiruv amalga oshirildi.' }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => null) as {
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
    const identityIsValid = applicationType === 'imtiyozli'
      ? isValidForeignIdNumber(passport)
      : isValidPassport(passport) && isValidJshshir(jshshir)
    if (!identityIsValid || !isValidEmail(email)) {
      return NextResponse.json({
        error: applicationType === 'imtiyozli'
          ? 'Pasport/ID yoki email formati noto‘g‘ri.'
          : 'Pasport, JShSHIR yoki email formati noto‘g‘ri.',
      }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    let query = supabase
      .from('permit_requests')
      .select('id, full_name, status, room_number, reject_reason, created_at, faculty, phone, gender, direction, course, application_type')
      .eq('passport_series', passport)
      .eq('email', email)
      .eq('application_type', applicationType)

    query = applicationType === 'imtiyozli'
      ? query.is('jshshir', null)
      : query.eq('jshshir', jshshir)

    const { data, error } = await query
      .maybeSingle()
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
    // rather than forwarding the raw row. phone/gender/faculty/direction/
    // course ride along even though the status page itself doesn't show
    // them — /register reads this same endpoint to prefill the signup
    // wizard from the approved permit, so the student never retypes what
    // they already submitted here.
    return NextResponse.json({
      data: {
        id: data.id,
        full_name: data.full_name,
        status: data.status,
        room_number: data.room_number,
        reject_reason: data.reject_reason,
        created_at: data.created_at,
        phone: data.phone,
        gender: data.gender,
        faculty: data.faculty,
        direction: data.direction,
        course: data.course,
        application_type: data.application_type,
        queuePosition,
        queueTotal,
      },
    })
  } catch (error) {
    console.error('Permit status lookup failed:', error)
    return NextResponse.json({ error: 'Holatni tekshirishda server xatoligi yuz berdi.' }, { status: 500 })
  }
}
