import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { getPasswordPolicyError } from '@/lib/password-policy'
import {
  buildFullName,
  getNamePartError,
  isValidEmail,
  isValidForeignIdNumber,
  isValidJshshir,
  isValidPassport,
  namesLikelyMatch,
  normalizeForeignIdNumber,
  normalizeJshshir,
  normalizePassport,
} from '@/lib/permit-validation'
import { cyrillicToLatin } from '@/lib/transliterate'
import { writeAuditLog } from '@/lib/audit-log'
import { extractFloor } from '@/lib/floor'
import { createAuthUserSafely, deleteAuthUserSafely, updateAuthUserPasswordSafely } from '@/lib/supabase-admin-auth'

function text(body: Record<string, unknown>, key: string, maxLength = 200) {
  return String(body[key] ?? '').trim().slice(0, maxLength)
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const throttle = await checkRateLimit(`student-register:${ip}`, 5, 15 * 60_000)
  if (!throttle.allowed) {
    return NextResponse.json(
      { error: 'Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.' },
      { status: 429 },
    )
  }

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ error: 'Noto‘g‘ri so‘rov' }, { status: 400 })
    }

    const submittedJshshir = normalizeJshshir(body.jshshir)
    // A foreign registration has no JShSHIR. Deriving that here as well as
    // reading the client hint prevents stale/lost sessionStorage state from
    // accidentally switching an imtiyozli applicant back to yo'llanma at
    // the final submit. The approved permit lookup below remains authoritative.
    const applicationType = body.applicationType === 'imtiyozli' || !submittedJshshir
      ? 'imtiyozli'
      : 'yollanma'
    const passport = applicationType === 'imtiyozli'
      ? normalizeForeignIdNumber(body.passportSeries)
      : normalizePassport(body.passportSeries)
    const jshshir = submittedJshshir
    const email = text(body, 'email', 254).toLowerCase()
    const firstName = cyrillicToLatin(text(body, 'firstName', 80))
    const lastName = cyrillicToLatin(text(body, 'lastName', 80))
    const noMiddleName = applicationType === 'imtiyozli' && body.noMiddleName === true
    const middleName = noMiddleName ? '' : cyrillicToLatin(text(body, 'middleName', 80))
    const fullName = buildFullName({ lastName, firstName, middleName })
    const phone = text(body, 'phone', 32)
    const gender = text(body, 'gender', 16)
    const faculty = text(body, 'faculty', 160)
    const direction = text(body, 'direction', 160)
    const course = Number(body.course)
    const passportDate = text(body, 'passportDate', 10)
    const birthDate = text(body, 'birthDate', 10)
    const entryDate = text(body, 'entryDate', 10)

    if (
      !(applicationType === 'imtiyozli' ? isValidForeignIdNumber(passport) : isValidPassport(passport))
      || (applicationType === 'yollanma' && !isValidJshshir(jshshir))
      || !isValidEmail(email)
    ) {
      return NextResponse.json(
        { error: applicationType === 'imtiyozli' ? 'Pasport/ID yoki email formati noto‘g‘ri.' : 'Pasport, JShSHIR yoki email formati noto‘g‘ri.' },
        { status: 400 },
      )
    }
    const nameError = getNamePartError(lastName, 'Familiya')
      || getNamePartError(firstName, 'Ism')
      || (applicationType === 'imtiyozli' && (noMiddleName || !middleName)
        ? null
        : getNamePartError(middleName, 'Otasining ismi'))
    if (
      nameError
      || !phone
      || !['male', 'female'].includes(gender)
      || !faculty
      || !direction
    ) {
      return NextResponse.json(
        { error: 'Majburiy shaxsiy va ta’lim ma’lumotlari to‘liq emas.' },
        { status: 400 },
      )
    }
    if (
      !Number.isInteger(course)
      || course < 1
      || course > 6
      || !validDate(passportDate)
      || !validDate(birthDate)
      || !validDate(entryDate)
    ) {
      return NextResponse.json(
        { error: 'Kurs yoki sana ma’lumotlari noto‘g‘ri.' },
        { status: 400 },
      )
    }

    // The student now picks their own password in the wizard (no email-link
    // step). Same policy the /update-password flow enforces.
    const password = String(body.password ?? '')
    const passwordError = getPasswordPolicyError(password)
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    let permitQuery = supabase
      .from('permit_requests')
      .select('email, full_name, gender, faculty, direction, course, room_number, status, origin_country, origin_region, study_type, application_type')
      .eq('passport_series', passport)
      .eq('email', email)
      .eq('application_type', applicationType)

    permitQuery = applicationType === 'imtiyozli'
      ? permitQuery.is('jshshir', null)
      : permitQuery.eq('jshshir', jshshir)

    const { data: permit, error: permitError } = await permitQuery
      .maybeSingle()
    if (permitError) throw permitError

    if (!permit || permit.status !== 'approved') {
      await writeAuditLog({
        eventType: 'student.registration',
        status: 'denied',
        ipAddress: ip,
        targetRole: 'talaba',
      })
      return NextResponse.json(
        { error: 'Ariza hali tasdiqlanmagan yoki ma’lumotlar mos emas.' },
        { status: 403 },
      )
    }

    if (
      permit.email.trim().toLowerCase() !== email
      || permit.faculty.trim().toLowerCase() !== faculty.toLowerCase()
      || !namesLikelyMatch(fullName, permit.full_name)
    ) {
      return NextResponse.json(
        { error: 'Ro‘yxatdan o‘tish ma’lumotlari tasdiqlangan yo‘llanma bilan mos emas.' },
        { status: 403 },
      )
    }

    let existingUserQuery = supabase
      .from('users')
      .select('id, email, role, status')
      .eq('passport_series', passport)

    existingUserQuery = applicationType === 'imtiyozli'
      ? existingUserQuery.is('jshshir', null).eq('email', email)
      : existingUserQuery.eq('jshshir', jshshir)

    const { data: existingUser, error: existingUserError } = await existingUserQuery
      .maybeSingle()
    if (existingUserError) throw existingUserError

    if (existingUser) {
      const isSamePendingStudent =
        existingUser.role === 'talaba'
        && existingUser.status === 'pending'
        && existingUser.email?.trim().toLowerCase() === email

      if (!isSamePendingStudent) {
        return NextResponse.json(
          { error: 'Bu ma’lumotlar bilan akkaunt mavjud.' },
          { status: 409 },
        )
      }

      // They already started registering (pending row + Auth account) and are
      // coming back through the wizard. The approved-permit match above already
      // authorized this; set the fresh password so the auto-login works.
      const { error: pwError } = await updateAuthUserPasswordSafely(existingUser.id, password)
      if (pwError) {
        console.error('Pending student password update failed:', pwError)
        return NextResponse.json({ error: 'Akkauntni yangilab bo‘lmadi.' }, { status: 409 })
      }
      return NextResponse.json({ ok: true }, { status: 200 })
    }

    const { data: authData, error: authError } = await createAuthUserSafely(
      email,
      password,
      { role: 'talaba', registration_pending: true },
    )
    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Bu email bilan akkaunt mavjud yoki akkaunt yaratib bo‘lmadi.' },
        { status: 409 },
      )
    }

    let assignedFloor: number | null = null
    if (permit.room_number) {
      const { data: layoutRow } = await supabase
        .from('floor_room_layout')
        .select('floor_number')
        .eq('room_number', permit.room_number)
        .maybeSingle()
      assignedFloor = layoutRow?.floor_number ?? extractFloor(permit.room_number)
    }

    // Foreign (imtiyozli) students don't enter a UZ address — origin comes from
    // the permit. Domestic students fill region/district/mahalla in the wizard.
    const isForeign = applicationType === 'imtiyozli'

    const { error: insertError } = await supabase.from('users').insert({
      id: authData.user.id,
      email,
      full_name: fullName,
      middle_name: middleName || null,
      region: isForeign ? (permit.origin_region || null) : (text(body, 'region', 120) || null),
      district: isForeign ? null : (text(body, 'district', 120) || null),
      mahalla: isForeign ? null : (text(body, 'mahalla', 160) || null),
      country: isForeign ? (permit.origin_country || null) : null,
      passport_series: passport,
      jshshir: applicationType === 'imtiyozli' ? null : jshshir,
      passport_date: passportDate,
      birth_date: birthDate,
      faculty: permit.faculty,
      direction: permit.direction,
      course: permit.course,
      nationality: text(body, 'nationality', 80) || null,
      study_type: permit.study_type ?? (text(body, 'study_type', 40) || null),
      gender: permit.gender,
      phone_number: phone,
      father_full_name: cyrillicToLatin(text(body, 'father_full_name', 160)) || null,
      father_workplace: text(body, 'father_workplace', 200) || null,
      father_phone: text(body, 'father_phone', 32) || null,
      mother_full_name: cyrillicToLatin(text(body, 'mother_full_name', 160)) || null,
      mother_workplace: text(body, 'mother_workplace', 200) || null,
      mother_phone: text(body, 'mother_phone', 32) || null,
      room_number: permit.room_number,
      assigned_floor: assignedFloor,
      entry_date: entryDate,
      role: 'talaba',
      status: 'pending',
    })

    if (insertError) {
      const { error: cleanupError } = await deleteAuthUserSafely(authData.user.id)
      if (cleanupError) {
        console.error('Student Auth cleanup failed:', cleanupError)
      }
      console.error('Student pending profile insert failed:', insertError)
      return NextResponse.json({ error: 'Akkaunt yaratib bo‘lmadi.' }, { status: 409 })
    }

    await writeAuditLog({
      eventType: 'student.registration',
      status: 'success',
      ipAddress: ip,
      actorUserId: authData.user.id,
      targetRole: 'talaba',
      details: { stage: 'pending_auto_login' },
    })
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    console.error('Student registration failed:', error)
    return NextResponse.json(
      { error: 'Ro‘yxatdan o‘tishda server xatoligi yuz berdi.' },
      { status: 500 },
    )
  }
}
