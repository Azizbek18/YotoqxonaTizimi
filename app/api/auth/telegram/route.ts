import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { writeAuditLog } from '@/lib/audit-log'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { getServiceSupabase } from '@/lib/server-supabase'
import { verifyTelegramInitData } from '@/lib/telegram-init-data'

export const runtime = 'nodejs'

// Telegram hands the Mini App a fresh initData on every launch, so a short
// window costs real users nothing and limits replay of a leaked string.
const INIT_DATA_MAX_AGE_SECONDS = 60 * 60

const fail = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status })

/**
 * Signs a student in from a Telegram Mini App launch. Telegram's webview does
 * not reliably keep cookies between launches (notably Telegram Desktop), so the
 * password session alone would ask for a login every time.
 *
 * Trust chain: HMAC-verified initData → Telegram user id → the ONE student whose
 * `student_telegram_links.chat_id` equals it (bound earlier via a deep link the
 * student opened while logged in). Anything ambiguous falls back to the normal
 * login form: unlinked chat, a chat shared by several students, inactive account.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  try {
    const ipLimit = await checkRateLimit(`tg-login:ip:${ip}`, 20, 60_000)
    if (!ipLimit.allowed) return fail(429, 'Juda ko‘p urinish. Keyinroq urinib ko‘ring.')

    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!botToken || !supabaseUrl || !anonKey) {
      console.error('Telegram login is missing environment variables')
      return fail(500, 'Server sozlanmagan')
    }

    const body = await request.json().catch(() => null) as { initData?: unknown } | null
    const initData = typeof body?.initData === 'string' ? body.initData : ''
    const verified = verifyTelegramInitData(initData, botToken, { maxAgeSeconds: INIT_DATA_MAX_AGE_SECONDS })
    if (!verified) {
      await writeAuditLog({ eventType: 'telegram_login', status: 'denied', ipAddress: ip, details: { reason: 'invalid_init_data' } })
      return fail(401, 'Telegram ma’lumoti yaroqsiz')
    }

    const userLimit = await checkRateLimit(`tg-login:user:${verified.userId}`, 10, 60_000)
    if (!userLimit.allowed) return fail(429, 'Juda ko‘p urinish. Keyinroq urinib ko‘ring.')

    const service = getServiceSupabase()
    const { data: links, error: linkError } = await service
      .from('student_telegram_links')
      .select('student_id')
      .eq('chat_id', verified.userId)
      .limit(2)
    if (linkError) throw linkError
    if (!links || links.length !== 1) {
      await writeAuditLog({
        eventType: 'telegram_login', status: 'denied', ipAddress: ip,
        details: { reason: links?.length ? 'chat_shared_by_multiple_students' : 'chat_not_linked' },
      })
      return fail(404, 'Telegram akkaunt hisobga ulanmagan')
    }
    const studentId = links[0].student_id

    // Same gate as /api/auth/resolve-role: only an active student gets in.
    const { data: student, error: studentError } = await service
      .from('users')
      .select('role, status')
      .eq('id', studentId)
      .maybeSingle()
    if (studentError) throw studentError
    if (student?.role !== 'talaba' || student.status !== 'active') {
      await writeAuditLog({
        eventType: 'telegram_login', status: 'denied', ipAddress: ip, actorUserId: studentId,
        details: { reason: 'account_not_active' },
      })
      return fail(403, 'Hisob faol emas')
    }

    const { data: authUser, error: authUserError } = await service.auth.admin.getUserById(studentId)
    const email = authUser?.user?.email
    if (authUserError || !email) throw authUserError ?? new Error('Auth user has no email')

    // Mint a one-time token for this user and redeem it immediately through the
    // cookie-writing server client: it creates a real auth session (so the
    // live-session checks pass) and sets the same cookies as a password login.
    const { data: linkData, error: generateError } = await service.auth.admin.generateLink({ type: 'magiclink', email })
    const tokenHash = linkData?.properties?.hashed_token
    if (generateError || !tokenHash) throw generateError ?? new Error('generateLink returned no token')

    const response = NextResponse.json({ ok: true, role: 'talaba' })
    const supabase = createServerClient(supabaseUrl, anonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })
    const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
    if (verifyError) throw verifyError

    await writeAuditLog({ eventType: 'telegram_login', status: 'success', ipAddress: ip, actorUserId: studentId, targetRole: 'talaba' })
    return response
  } catch (error) {
    console.error('Telegram login failed:', error)
    return fail(500, 'Server xatoligi')
  }
}
