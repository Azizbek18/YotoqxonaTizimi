import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { createAuthUserSafely, deleteAuthUserSafely } from '@/lib/supabase-admin-auth'
import {
  validateRegisterCode,
  validateStaffId,
  validateStaffLink,
  type StaffRole,
} from '@/lib/staff-access'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { getPasswordPolicyError } from '@/lib/password-policy'
import { isPermitFacultyValue } from '@/lib/faculties'

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const throttle = await checkRateLimit(`staff-register:${ip}`, 5, 15 * 60_000)
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
    const staffId = typeof body.staffId === 'string' ? body.staffId.trim() : ''
    const registerCode = typeof body.registerCode === 'string' ? body.registerCode : ''
    const linkKey = typeof body.linkKey === 'string' ? body.linkKey : ''
    const faculty = typeof body.faculty === 'string' ? body.faculty.trim() : ''

    if (role !== 'dekan') {
      return NextResponse.json({ ok: false, error: "Noto'g'ri rol" }, { status: 400 })
    }

    if (!isPermitFacultyValue(faculty)) {
      return NextResponse.json({ ok: false, error: "Fakultet noto'g'ri tanlangan" }, { status: 400 })
    }

    if (fullName.length < 3 || !/^\S+@\S+\.\S+$/.test(email) || !password || !confirmPassword) {
      return NextResponse.json({ ok: false, error: "Majburiy maydonlar to'ldirilmagan" }, { status: 400 })
    }

    const passwordError = getPasswordPolicyError(password)
    if (password !== confirmPassword || passwordError) {
      return NextResponse.json({ ok: false, error: password !== confirmPassword ? 'Parollar bir xil emas' : passwordError }, { status: 400 })
    }

    const linkOk = validateStaffLink(role, linkKey)
    const idOk = validateStaffId(staffId)
    const codeOk = validateRegisterCode(registerCode)
    if (!linkOk || !idOk || !codeOk) {
      return NextResponse.json({ ok: false, error: 'Ruxsat rad etildi' }, { status: 403 })
    }

    const supabase = getServiceSupabase()

    const { data: authData, error: authError } = await createAuthUserSafely(email, password, { role })
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: "Ro'yxatdan o'tishda xatolik" }, { status: 400 })
    }

    const { error: userError } = await supabase.from('staff').insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      phone_number: phone || null,
      role,
      status: 'active',
      faculty,
      // staff_id has a UNIQUE constraint. Persisting the validated allow-list
      // id makes the registration credential single-use under concurrent calls.
      staff_id: staffId,
    })

    if (userError) {
      await deleteAuthUserSafely(authData.user.id)
      if (userError.code === '23505') {
        return NextResponse.json({ ok: false, error: 'Bu maxsus ID yoki email avval ishlatilgan' }, { status: 409 })
      }
      console.error('Staff profile insert failed:', userError)
      return NextResponse.json({ ok: false, error: "Xodim profilini yaratib bo'lmadi" }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatoligi' }, { status: 500 })
  }
}
