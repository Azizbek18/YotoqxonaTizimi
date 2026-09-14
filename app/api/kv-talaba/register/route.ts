import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { createAuthUserSafely, deleteAuthUserSafely } from '@/lib/supabase-admin-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { getPasswordPolicyError } from '@/lib/password-policy'
import { isPermitFacultyValue } from '@/lib/faculties'
import { directionBelongsToFaculty, normalizeDirection } from '@/lib/directions'

const EMAIL_RE = /^\S+@\S+\.\S+$/

// KV-talaba (off-campus student) self-registration — deliberately the
// mirror image of app/api/student/register: no permit_requests lookup, no
// document, no passport/jshshir. A dekan-approved (interim; HEMIS/OneID
// later — see off_campus_verified_by) `users` row lands `status: 'pending'`
// the same way app/api/staff/register lands a staff row `status: 'active'`
// directly — just gated behind an approval step instead of being immediate,
// since there's no invite code here to stand in for verification yet.
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const throttle = await checkRateLimit(`kv-talaba-register:${ip}`, 5, 15 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ ok: false, error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }

    const body = await request.json()
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const gender = body.gender === 'male' || body.gender === 'female' ? body.gender : ''
    const faculty = typeof body.faculty === 'string' ? body.faculty.trim() : ''
    const direction = typeof body.direction === 'string' ? body.direction.trim() : ''
    const course = Number(body.course)
    const group = typeof body.group === 'string' ? body.group.trim() : ''
    const hemisStudentId = typeof body.hemisStudentId === 'string' ? body.hemisStudentId.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''

    if (fullName.length < 3 || !password || !confirmPassword) {
      return NextResponse.json({ ok: false, error: "Majburiy maydonlar to'ldirilmagan" }, { status: 400 })
    }
    if (!EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ ok: false, error: "Email noto'g'ri" }, { status: 400 })
    }
    if (!gender) {
      return NextResponse.json({ ok: false, error: "Jins tanlanmagan" }, { status: 400 })
    }
    if (!isPermitFacultyValue(faculty)) {
      return NextResponse.json({ ok: false, error: "Fakultet tanlanmagan" }, { status: 400 })
    }
    if (!directionBelongsToFaculty(faculty, direction)) {
      return NextResponse.json({ ok: false, error: "Yo'nalish tanlanmagan" }, { status: 400 })
    }
    if (!Number.isInteger(course) || course < 1 || course > 6) {
      return NextResponse.json({ ok: false, error: "Kurs noto'g'ri" }, { status: 400 })
    }
    const passwordError = getPasswordPolicyError(password)
    if (password !== confirmPassword || passwordError) {
      return NextResponse.json(
        { ok: false, error: password !== confirmPassword ? 'Parollar bir xil emas' : passwordError },
        { status: 400 },
      )
    }

    const supabase = getServiceSupabase()

    const { data: existing } = await supabase.from('users').select('id').ilike('email', email).maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: false, error: "Bu email allaqachon ro'yxatdan o'tgan" }, { status: 409 })
    }

    const { data: authData, error: authError } = await createAuthUserSafely(email, password, { role: 'talaba' })
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: "Ro'yxatdan o'tishda xatolik" }, { status: 400 })
    }

    const { error: insertError } = await supabase.from('users').insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      phone_number: phone || null,
      gender,
      role: 'talaba',
      status: 'pending',
      faculty,
      direction: normalizeDirection(direction),
      course,
      group: group || null,
      hemis_student_id: hemisStudentId || null,
      is_off_campus: true,
      room_number: null,
      dorm_id: null,
      assigned_floor: null,
    })

    if (insertError) {
      await deleteAuthUserSafely(authData.user.id)
      if (insertError.code === '23505') {
        return NextResponse.json({ ok: false, error: "Bu email avval ishlatilgan" }, { status: 409 })
      }
      console.error('KV-talaba profile insert failed:', insertError)
      return NextResponse.json({ ok: false, error: "Profil yaratib bo'lmadi" }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('KV-talaba register POST failed:', error)
    return NextResponse.json({ ok: false, error: 'Server xatoligi' }, { status: 500 })
  }
}
