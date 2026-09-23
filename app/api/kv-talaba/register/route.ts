import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { createAuthUserSafely, deleteAuthUserSafely } from '@/lib/supabase-admin-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { getPasswordPolicyError } from '@/lib/password-policy'
import { isPermitFacultyValue } from '@/lib/faculties'
import { directionBelongsToFaculty, normalizeDirection } from '@/lib/directions'
import { buildFullName, getNamePartError, toTitleCaseName } from '@/lib/permit-validation'
import { cyrillicToLatin } from '@/lib/transliterate'

const EMAIL_RE = /^\S+@\S+\.\S+$/

function text(body: Record<string, unknown>, key: string, maxLength = 200) {
  return String(body[key] ?? '').trim().slice(0, maxLength)
}

// KV-talaba (off-campus student) self-registration — deliberately the
// mirror image of app/api/student/register: no permit_requests lookup, no
// document, no passport/jshshir. No dekan approval gate either (user
// decision 2026-09-15: real verification needs HEMIS/OneID access this
// project doesn't have yet, and a manual dekan queue with nothing reliable
// to check it against was pure friction) — the row lands `status: 'active'`
// immediately, the same way app/api/staff/register lands a staff row.
// off_campus_verified_by stays null (no one verified this account); it's
// still the field a future HEMIS/OneID check would write to.
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const throttle = await checkRateLimit(`kv-talaba-register:${ip}`, 5, 15 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ ok: false, error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }

    const body = await request.json()
    const firstName = toTitleCaseName(cyrillicToLatin(text(body, 'firstName', 80)))
    const lastName = toTitleCaseName(cyrillicToLatin(text(body, 'lastName', 80)))
    const noMiddleName = Boolean(body.noMiddleName)
    const middleName = noMiddleName ? '' : toTitleCaseName(cyrillicToLatin(text(body, 'middleName', 80)))
    const fullName = buildFullName({ lastName, firstName, middleName })
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

    if (!password || !confirmPassword) {
      return NextResponse.json({ ok: false, error: "Majburiy maydonlar to'ldirilmagan" }, { status: 400 })
    }
    const nameError = getNamePartError(lastName, 'Familiya')
      || getNamePartError(firstName, 'Ism')
      || (noMiddleName ? null : getNamePartError(middleName, 'Otasining ismi'))
    if (nameError) {
      return NextResponse.json({ ok: false, error: nameError }, { status: 400 })
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

    // Dorm applicants kept landing here by mistake ("Kvartira hisobi" on the
    // landing page) — the KV account then squats their permit email and the
    // real /register wizard fails with "Bu email bilan akkaunt avval
    // yaratilgan". Anyone with a live dorm application must use /register.
    const { data: dormPermit, error: dormPermitError } = await supabase
      .from('permit_requests')
      .select('status')
      .ilike('email', email)
      .neq('status', 'rejected')
      .limit(1)
      .maybeSingle()
    if (dormPermitError) throw dormPermitError
    if (dormPermit) {
      return NextResponse.json({
        ok: false,
        code: 'dorm_permit_exists',
        error: dormPermit.status === 'approved'
          ? "Bu email bilan yotoqxona arizangiz tasdiqlangan. Kvartira ro'yxati siz uchun emas — «Ro'yxatdan o'tish» (/register) orqali o'ting."
          : "Bu email bilan yotoqxonaga ariza topshirgansiz. Kvartira ro'yxati siz uchun emas — arizangiz tasdiqlangach «Ro'yxatdan o'tish» (/register) orqali o'ting.",
      }, { status: 409 })
    }

    const { data: authData, error: authError } = await createAuthUserSafely(email, password, { role: 'talaba' })
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: "Ro'yxatdan o'tishda xatolik" }, { status: 400 })
    }

    const { error: insertError } = await supabase.from('users').insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      middle_name: middleName || null,
      phone_number: phone || null,
      gender,
      role: 'talaba',
      status: 'active',
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
