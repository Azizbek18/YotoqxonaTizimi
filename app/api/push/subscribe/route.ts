import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/server-auth'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { normalizeForeignIdNumber } from '@/lib/permit-validation'

type SubscribeBody = {
  endpoint?: unknown
  expirationTime?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
  permitBinding?: { id?: unknown; passport?: unknown; email?: unknown }
}

const jsonError = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status })

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  if (!publicKey) return jsonError('Bildirishnoma xizmati hali sozlanmagan', 503)
  return NextResponse.json({ ok: true, publicKey })
}

export async function POST(request: Request) {
  const throttle = await checkRateLimit(`push-subscribe:${getClientIp(request)}`, 12, 10 * 60_000)
  if (!throttle.allowed) return jsonError("Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.", 429)

  let body: SubscribeBody
  try {
    body = await request.json() as SubscribeBody
  } catch {
    return jsonError("So‘rov formati noto‘g‘ri", 400)
  }

  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : ''
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : ''
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth.trim() : ''
  if (!endpoint.startsWith('https://') || endpoint.length > 4096 || p256dh.length < 20 || p256dh.length > 512 || auth.length < 8 || auth.length > 256) {
    return jsonError("Bildirishnoma obunasi noto‘g‘ri", 400)
  }

  const supabase = getServiceSupabase()
  const authUser = await getRequestUser(request)
  let userId: string | null = null
  let permitRequestId: string | null = null

  if (authUser?.id) {
    const { data: student, error } = await supabase
      .from('users')
      .select('id, role, status')
      .eq('id', authUser.id)
      .maybeSingle()
    if (error) return jsonError("Talaba profilini tekshirib bo‘lmadi", 500)
    if (!student || student.role !== 'talaba' || student.status !== 'active') {
      return jsonError('Faol talaba akkaunti talab qilinadi', 403)
    }
    userId = student.id
  } else {
    const id = typeof body.permitBinding?.id === 'string' ? body.permitBinding.id.trim() : ''
    const passport = normalizeForeignIdNumber(body.permitBinding?.passport)
    const email = typeof body.permitBinding?.email === 'string' ? body.permitBinding.email.trim().toLowerCase() : ''
    if (!id || !passport || !email) return jsonError('Ariza bog‘lanishi topilmadi', 401)

    const { data: permit, error } = await supabase
      .from('permit_requests')
      .select('id')
      .eq('id', id)
      .eq('passport_series', passport)
      .ilike('email', email)
      .maybeSingle()
    if (error) return jsonError("Arizani tekshirib bo‘lmadi", 500)
    if (!permit) return jsonError("Ariza ma’lumotlari mos kelmadi", 403)
    permitRequestId = permit.id
  }

  const expirationTime = typeof body.expirationTime === 'number' && Number.isSafeInteger(body.expirationTime)
    ? body.expirationTime
    : null
  const now = new Date().toISOString()
  const { error } = await supabase.from('push_subscriptions').upsert({
    endpoint,
    p256dh,
    auth,
    user_id: userId,
    permit_request_id: permitRequestId,
    expiration_time: expirationTime,
    user_agent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
    enabled: true,
    updated_at: now,
  }, { onConflict: 'endpoint' })
  if (error) {
    console.error('Push subscription save failed:', error)
    return jsonError("Bildirishnomani saqlab bo‘lmadi", 500)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const endpoint = new URL(request.url).searchParams.get('endpoint')?.trim()
  if (!endpoint) return jsonError('Obuna topilmadi', 400)

  const authUser = await getRequestUser(request)
  if (!authUser?.id) return jsonError('Autentifikatsiya talab qilinadi', 401)
  const { error } = await getServiceSupabase()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', authUser.id)
  if (error) return jsonError("Obunani o‘chirib bo‘lmadi", 500)
  return NextResponse.json({ ok: true })
}
