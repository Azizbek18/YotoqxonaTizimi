import { NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/server-auth'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'

type SubscribeBody = {
  token?: unknown
  platform?: unknown
}

const jsonError = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status })

// FCM tokens for the native Flutter student app. Unlike /api/push/subscribe
// (Web Push), there is no permit-binding fallback here: the Flutter app is
// login-only, so a caller with no active student session is simply
// unauthenticated, not "not yet registered".
export async function POST(request: Request) {
  const throttle = await checkRateLimit(`fcm-subscribe:${getClientIp(request)}`, 12, 10 * 60_000)
  if (!throttle.allowed) return jsonError('Juda ko‘p urinish. Birozdan keyin qayta urinib ko‘ring.', 429)

  let body: SubscribeBody
  try {
    body = await request.json() as SubscribeBody
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonError("So‘rov formati noto‘g‘ri", 400)
    }
  } catch {
    return jsonError("So‘rov formati noto‘g‘ri", 400)
  }

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  const platform = body.platform === 'ios' ? 'ios' : body.platform === 'android' ? 'android' : ''
  if (token.length < 32 || token.length > 4096 || !platform) {
    return jsonError('Bildirishnoma tokeni noto‘g‘ri', 400)
  }

  const authUser = await getRequestUser(request)
  if (!authUser?.id) return jsonError('Autentifikatsiya talab qilinadi', 401)

  const supabase = getServiceSupabase()
  const { data: student, error: studentError } = await supabase
    .from('users')
    .select('id, role, status')
    .eq('id', authUser.id)
    .maybeSingle()
  if (studentError) return jsonError('Talaba profilini tekshirib bo‘lmadi', 500)
  if (!student || student.role !== 'talaba' || student.status !== 'active') {
    return jsonError('Faol talaba akkaunti talab qilinadi', 403)
  }

  const { error } = await supabase.from('fcm_tokens').upsert({
    token,
    user_id: student.id,
    platform,
    enabled: true,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'token' })
  if (error) {
    console.error('FCM token save failed:', error)
    return jsonError('Tokenni saqlab bo‘lmadi', 500)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const token = new URL(request.url).searchParams.get('token')?.trim()
  if (!token) return jsonError('Token topilmadi', 400)

  const authUser = await getRequestUser(request)
  if (!authUser?.id) return jsonError('Autentifikatsiya talab qilinadi', 401)

  const { error } = await getServiceSupabase()
    .from('fcm_tokens')
    .delete()
    .eq('token', token)
    .eq('user_id', authUser.id)
  if (error) return jsonError('Tokenni o‘chirib bo‘lmadi', 500)
  return NextResponse.json({ ok: true })
}
