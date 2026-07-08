import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit, getClientIp } from '@/lib/security'

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const throttle = checkRateLimit(`student-register:${ip}`, 10, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ ok: false, error: 'Juda ko\'p urinish. Keyinroq urinib ko\'ring.' }, { status: 429 })
    }

    const body = await request.json()
    const password = typeof body.password === 'string' ? body.password : ''
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const userPayload = body.userPayload as Record<string, unknown>

    if (!email || !password || !confirmPassword) {
      return NextResponse.json({ ok: false, error: "Majburiy maydonlar to'ldirilmagan" }, { status: 400 })
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ ok: false, error: 'Parollar mos emas' }, { status: 400 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ ok: false, error: 'Server konfiguratsiyasi to\'liq emas' }, { status: 500 })
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey)

    const passportSeriesClean = typeof userPayload?.passport_series === 'string'
      ? userPayload.passport_series.toUpperCase().replace(/\s/g, '')
      : ''
    const jshshirClean = typeof userPayload?.jshshir === 'string'
      ? userPayload.jshshir.trim()
      : ''

    // Check each field independently with parameterized .eq() lookups rather
    // than interpolating user-supplied values into a single `.or()` filter
    // string (PostgREST's or() mini-language treats commas/dots as syntax,
    // so raw interpolation there is an injection vector, and these values
    // come straight from an unauthenticated public registration form).
    try {
      if (email) {
        const { data } = await supabase.from('users').select('id').eq('email', email).maybeSingle()
        if (data) {
          return NextResponse.json({ ok: false, error: "Ushbu Email manzili tizimda allaqachon ro'yxatdan o'tgan!" }, { status: 400 })
        }
      }
      if (passportSeriesClean) {
        const { data } = await supabase.from('users').select('id').eq('passport_series', passportSeriesClean).maybeSingle()
        if (data) {
          return NextResponse.json({ ok: false, error: "Ushbu Pasport seriyasi bilan ro'yxatdan o'tgan foydalanuvchi allaqachon mavjud!" }, { status: 400 })
        }
      }
      if (jshshirClean) {
        const { data } = await supabase.from('users').select('id').eq('jshshir', jshshirClean).maybeSingle()
        if (data) {
          return NextResponse.json({ ok: false, error: "Ushbu JShSHIR bilan ro'yxatdan o'tgan foydalanuvchi allaqachon mavjud!" }, { status: 400 })
        }
      }
    } catch {
      return NextResponse.json({ ok: false, error: "Tekshirishda xatolik yuz berdi" }, { status: 500 })
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { role: 'talaba' },
    })

    if (authError || !authData.user) {
      let msg = authError?.message ?? "Ro'yxatdan o'tishda xatolik"
      if (msg.includes("already registered") || msg.toLowerCase().includes("user already exists")) {
        msg = "Ushbu email manziliga ega foydalanuvchi allaqachon ro'yxatdan o'tgan!"
      }
      return NextResponse.json({ ok: false, error: msg }, { status: 400 })
    }

    const { error: dbError } = await supabase.from('users').insert({
      id: authData.user.id,
      ...userPayload,
      email,
      role: 'talaba',
      status: 'pending',
    })

    if (dbError) {
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ ok: false, error: dbError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatoligi' }, { status: 500 })
  }
}
