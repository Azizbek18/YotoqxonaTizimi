import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp, safeEqual } from '@/lib/security'

async function getAdminCount() {
  const supabase = getServiceSupabase()
  const { count, error } = await supabase
    .from('staff')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'admin')

  if (error) {
    throw new Error(error.message)
  }

  return count ?? 0
}

export async function GET() {
  try {
    const adminCount = await getAdminCount()
    const bootstrapConfigured = Boolean(process.env.ADMIN_BOOTSTRAP_CODE)

    return NextResponse.json({
      ok: true,
      needsBootstrap: adminCount === 0 && bootstrapConfigured,
    })
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Bootstrap holatini tekshirib bo‘lmadi' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const throttle = checkRateLimit(`admin-bootstrap:${ip}`, 10, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ ok: false, error: 'Juda ko‘p urinish. Keyinroq urinib ko‘ring.' }, { status: 429 })
    }

    const adminCount = await getAdminCount()
    if (adminCount > 0) {
      return NextResponse.json({ ok: false, error: 'Bootstrap endi yopilgan. Admin taklif kodidan foydalaning.' }, { status: 403 })
    }

    const body = await request.json()
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''
    const bootstrapCode = typeof body.bootstrapCode === 'string' ? body.bootstrapCode.trim() : ''

    if (!fullName || !email || !password || !confirmPassword || !bootstrapCode) {
      return NextResponse.json({ ok: false, error: 'Barcha maydonlarni to‘ldiring' }, { status: 400 })
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ ok: false, error: 'Parollar mos emas' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ ok: false, error: 'Parol kamida 6 ta belgidan iborat bo‘lishi kerak' }, { status: 400 })
    }

    if (!safeEqual(process.env.ADMIN_BOOTSTRAP_CODE, bootstrapCode)) {
      return NextResponse.json({ ok: false, error: 'Bootstrap kodi noto‘g‘ri' }, { status: 403 })
    }

    const supabase = getServiceSupabase()
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin' },
    })

    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: authError?.message || 'Admin yaratilmadi' }, { status: 400 })
    }

    const { error: insertError } = await supabase.from('staff').insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      staff_id: 'BOOTSTRAP-ADMIN',
      role: 'admin',
      status: 'active',
    })

    if (insertError) {
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatoligi' }, { status: 500 })
  }
}
