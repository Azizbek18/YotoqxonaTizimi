import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  validateRegisterCode,
  validateStaffId,
  validateStaffLink,
  type StaffRole,
} from '@/lib/staff-access'
import { checkRateLimit, getClientIp } from '@/lib/security'

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const throttle = checkRateLimit(`staff-register:${ip}`, 10, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ ok: false, error: 'Juda ko\'p urinish. Keyinroq urinib ko\'ring.' }, { status: 429 })
    }

    const body = await request.json()
    const role = body.role as StaffRole
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''
    const staffId = typeof body.staffId === 'string' ? body.staffId : ''
    const registerCode = typeof body.registerCode === 'string' ? body.registerCode : ''
    const linkKey = typeof body.linkKey === 'string' ? body.linkKey : ''

    if (role !== 'admin' && role !== 'tarbiyachi') {
      return NextResponse.json({ ok: false, error: "Noto'g'ri rol" }, { status: 400 })
    }

    if (!fullName || !email || !password || !confirmPassword) {
      return NextResponse.json({ ok: false, error: "Majburiy maydonlar to'ldirilmagan" }, { status: 400 })
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ ok: false, error: 'Parollar mos emas' }, { status: 400 })
    }

    const linkOk = validateStaffLink(role, linkKey)
    const idOk = validateStaffId(role, staffId)
    const codeOk = validateRegisterCode(role, registerCode)
    if (!linkOk || !idOk || !codeOk) {
      return NextResponse.json({ ok: false, error: 'Ruxsat rad etildi' }, { status: 403 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return NextResponse.json({ ok: false, error: 'Server konfiguratsiyasi to\'liq emas' }, { status: 500 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
    )

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role },
    })
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: "Ro'yxatdan o'tishda xatolik" }, { status: 400 })
    }

    const { error: userError } = await supabase.from('staff').insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      phone_number: phone || null,
      staff_id: staffId,
      role,
      status: 'active',
    })

    if (userError) {
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ ok: false, error: userError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatoligi' }, { status: 500 })
  }
}
