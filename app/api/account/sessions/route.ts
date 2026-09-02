import { NextRequest, NextResponse } from 'next/server'
import { getRequestSessionId, getRequestUser } from '@/lib/server-auth'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { listUserSessions, revokeOtherUserSessions, revokeUserSession } from '@/lib/auth-devices'
import { sendSessionsRevokedEmail } from '@/lib/email'
import { sendStudentTelegram } from '@/lib/student-telegram'

// The caller's own connected devices (auth.sessions). Any authenticated
// user — student or staff — can see and revoke their own.
export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user?.id) return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })
  try {
    const sessions = await listUserSessions(user.id, getRequestSessionId(request))
    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('list sessions failed:', error)
    return NextResponse.json({ error: 'Seanslarni yuklab bo‘lmadi' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user?.id) return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })

  const throttle = await checkRateLimit(`account-sessions:${user.id}:${getClientIp(request)}`, 20, 10 * 60_000)
  if (!throttle.allowed) {
    return NextResponse.json({ error: 'Juda ko‘p urinish. Birozdan keyin qayta uring.' }, { status: 429 })
  }

  const body = await request.json().catch(() => ({})) as { action?: string; sessionId?: string }
  const current = getRequestSessionId(request)

  try {
    if (body.action === 'revoke') {
      const sessionId = String(body.sessionId ?? '')
      if (!/^[0-9a-f-]{36}$/i.test(sessionId)) {
        return NextResponse.json({ error: 'Seans identifikatori noto‘g‘ri' }, { status: 400 })
      }
      if (sessionId === current) {
        return NextResponse.json({ error: 'Joriy qurilmani bu yerdan chiqarib bo‘lmaydi — «Chiqish»dan foydalaning' }, { status: 400 })
      }
      const ok = await revokeUserSession(user.id, sessionId)
      return NextResponse.json({ ok, revoked: ok ? 1 : 0 })
    }

    if (body.action === 'revoke-others') {
      const count = await revokeOtherUserSessions(user.id, current)
      if (count > 0) await notifyRevoked(user.id, count)
      return NextResponse.json({ ok: true, revoked: count })
    }

    return NextResponse.json({ error: 'Noma‘lum amal' }, { status: 400 })
  } catch (error) {
    console.error('revoke session failed:', error)
    return NextResponse.json({ error: 'Amalni bajarib bo‘lmadi' }, { status: 500 })
  }
}

async function notifyRevoked(userId: string, count: number) {
  const supabase = getServiceSupabase()
  const { data } = await supabase.from('users').select('email, full_name').eq('id', userId).maybeSingle()
  const name = data?.full_name ?? ''
  if (data?.email) {
    await sendSessionsRevokedEmail(data.email, name, count).catch(() => {})
  }
  await sendStudentTelegram(
    userId,
    `⚠️ <b>Xavfsizlik</b>\n\n${count} ta boshqa qurilma hisobingizdan chiqarildi.\n\nAgar bu siz bo‘lmasangiz — <b>parolingizni darhol o‘zgartiring</b>.`,
    { parseMode: 'HTML' },
  ).catch(() => {})
}
