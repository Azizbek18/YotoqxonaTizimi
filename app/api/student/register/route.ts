import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { isValidJshshir, isValidPassport, normalizeJshshir, normalizePassport } from '@/lib/permit-validation'
import { writeAuditLog } from '@/lib/audit-log'

function text(body: Record<string, unknown>, key: string, maxLength = 200) {
  return String(body[key] ?? '').trim().slice(0, maxLength)
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const throttle = await checkRateLimit(`student-register:${ip}`, 5, 15 * 60_000)
  if (!throttle.allowed) {
    return NextResponse.json({ error: 'Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.' }, { status: 429 })
  }

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return NextResponse.json({ error: 'Noto‘g‘ri so‘rov' }, { status: 400 })

    const passport = normalizePassport(body.passportSeries)
    const jshshir = normalizeJshshir(body.jshshir)
    const email = text(body, 'email', 254).toLowerCase()
    const password = String(body.password ?? '')
    const confirmPassword = String(body.confirmPassword ?? '')
    const firstName = text(body, 'firstName', 80)
    const lastName = text(body, 'lastName', 80)
    const middleName = text(body, 'middleName', 80)
    const fullName = `${lastName} ${firstName} ${middleName}`.replace(/\s+/g, ' ').trim()
    const phone = text(body, 'phone', 32)
    const gender = text(body, 'gender', 16)
    const faculty = text(body, 'faculty', 160)
    const direction = text(body, 'direction', 160)
    const course = Number(body.course)
    const passportDate = text(body, 'passportDate', 10)
    const birthDate = text(body, 'birthDate', 10)
    const entryDate = text(body, 'entryDate', 10)

    if (!isValidPassport(passport) || !isValidJshshir(jshshir) || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Pasport, JShSHIR yoki email formati noto‘g‘ri.' }, { status: 400 })
    }
    if (password !== confirmPassword || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      return NextResponse.json({ error: 'Parol kamida 8 belgi, harf va raqamdan iborat bo‘lishi kerak.' }, { status: 400 })
    }
    if (fullName.length < 5 || !phone || !['male', 'female'].includes(gender) || !faculty || !direction) {
      return NextResponse.json({ error: 'Majburiy shaxsiy va ta’lim ma’lumotlari to‘liq emas.' }, { status: 400 })
    }
    if (!Number.isInteger(course) || course < 1 || course > 6 || !validDate(passportDate) || !validDate(birthDate) || !validDate(entryDate)) {
      return NextResponse.json({ error: 'Kurs yoki sana ma’lumotlari noto‘g‘ri.' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const { data: permit, error: permitError } = await supabase
      .from('permit_requests')
      .select('id, email, full_name, gender, faculty, direction, course, room_number, status')
      .eq('passport_series', passport)
      .eq('jshshir', jshshir)
      .maybeSingle()
    if (permitError) throw permitError
    if (!permit || permit.status !== 'approved') {
      await writeAuditLog({ eventType: 'student.registration', status: 'denied', ipAddress: ip, targetRole: 'talaba' })
      return NextResponse.json({ error: 'Yo‘llanma hali tasdiqlanmagan yoki ma’lumotlar mos emas.' }, { status: 403 })
    }
    if (permit.email.trim().toLowerCase() !== email || permit.faculty.trim().toLowerCase() !== faculty.toLowerCase()) {
      return NextResponse.json({ error: 'Ro‘yxatdan o‘tish ma’lumotlari tasdiqlangan yo‘llanma bilan mos emas.' }, { status: 403 })
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'talaba' },
    })
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Bu email bilan akkaunt mavjud yoki akkaunt yaratib bo‘lmadi.' }, { status: 409 })
    }

    const userRow = {
      id: authData.user.id,
      email,
      full_name: fullName,
      middle_name: middleName || null,
      region: text(body, 'region', 120) || null,
      district: text(body, 'district', 120) || null,
      mahalla: text(body, 'mahalla', 160) || null,
      passport_series: passport,
      jshshir,
      passport_date: passportDate,
      birth_date: birthDate,
      faculty: permit.faculty,
      direction: permit.direction,
      course: permit.course,
      nationality: text(body, 'nationality', 80) || null,
      study_type: text(body, 'study_type', 40) || null,
      gender: permit.gender,
      phone_number: phone,
      father_full_name: text(body, 'father_full_name', 160) || null,
      father_workplace: text(body, 'father_workplace', 200) || null,
      father_phone: text(body, 'father_phone', 32) || null,
      mother_full_name: text(body, 'mother_full_name', 160) || null,
      mother_workplace: text(body, 'mother_workplace', 200) || null,
      mother_phone: text(body, 'mother_phone', 32) || null,
      room_number: permit.room_number,
      entry_date: entryDate,
      role: 'talaba',
      status: 'active',
    }

    const { error: insertError } = await supabase.from('users').insert(userRow)
    if (insertError) {
      await supabase.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json({ error: 'Profil yaratilmadi: ' + insertError.message }, { status: 409 })
    }

    const { data: updatedPermit, error: permitUpdateError } = await supabase
      .from('permit_requests')
      .update({ status: 'registered', updated_at: new Date().toISOString() })
      .eq('id', permit.id)
      .eq('status', 'approved')
      .select('id')
      .maybeSingle()
    if (permitUpdateError || !updatedPermit) {
      await supabase.from('users').delete().eq('id', authData.user.id)
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw permitUpdateError ?? new Error('Yo‘llanma holati parallel so‘rovda o‘zgardi')
    }

    await writeAuditLog({
      eventType: 'student.registration',
      status: 'success',
      ipAddress: ip,
      actorUserId: authData.user.id,
      targetRole: 'talaba',
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('Student registration failed:', error)
    return NextResponse.json({ error: 'Ro‘yxatdan o‘tishda server xatoligi yuz berdi.' }, { status: 500 })
  }
}
