import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { isValidJshshir, isValidPassport, normalizeJshshir, normalizePassport } from '@/lib/permit-validation'

export async function POST(request: NextRequest) {
  const throttle = await checkRateLimit(`permit-status:${getClientIp(request)}`, 15, 10 * 60_000)
  if (!throttle.allowed) {
    return NextResponse.json({ error: 'Juda ko‘p qidiruv amalga oshirildi.' }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => null) as { passportSeries?: unknown; jshshir?: unknown } | null
    const passport = normalizePassport(body?.passportSeries)
    const jshshir = normalizeJshshir(body?.jshshir)
    if (!isValidPassport(passport) || !isValidJshshir(jshshir)) {
      return NextResponse.json({ error: 'Pasport yoki JShSHIR formati noto‘g‘ri.' }, { status: 400 })
    }

    const { data, error } = await getServiceSupabase()
      .from('permit_requests')
      .select('id, full_name, status, room_number, reject_reason, created_at')
      .eq('passport_series', passport)
      .eq('jshshir', jshshir)
      .maybeSingle()
    if (error) throw error

    return NextResponse.json({ data: data ?? null })
  } catch (error) {
    console.error('Permit status lookup failed:', error)
    return NextResponse.json({ error: 'Holatni tekshirishda server xatoligi yuz berdi.' }, { status: 500 })
  }
}
