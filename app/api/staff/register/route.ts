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
import { hashInviteCode, normalizeInviteCode } from '@/lib/staff-invite'

type StaffInsert = {
  id: string
  email: string
  full_name: string
  phone_number: string | null
  role: string
  status: 'active'
  faculty: string
  staff_id?: string
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const throttle = await checkRateLimit(`staff-register:${ip}`, 5, 15 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ ok: false, error: 'Juda ko\'p urinish. Keyinroq urinib ko\'ring.' }, { status: 429 })
    }

    const body = await request.json()
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''
    const inviteCode = typeof body.inviteCode === 'string' ? normalizeInviteCode(body.inviteCode) : ''

    if (fullName.length < 3 || !/^\S+@\S+\.\S+$/.test(email) || !password || !confirmPassword) {
      return NextResponse.json({ ok: false, error: "Majburiy maydonlar to'ldirilmagan" }, { status: 400 })
    }
    const passwordError = getPasswordPolicyError(password)
    if (password !== confirmPassword || passwordError) {
      return NextResponse.json({ ok: false, error: password !== confirmPassword ? 'Parollar bir xil emas' : passwordError }, { status: 400 })
    }

    const supabase = getServiceSupabase()

    // Bir email bir marta — ochiq xato bo'lmasligi uchun oldindan tekshiramiz
    // (taklif kodi flow'ida bu use_count sarflanmasdan oldin bo'ladi).
    const { data: existing } = await supabase.from('staff').select('id').eq('email', email).maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: false, error: 'Bu email allaqachon ro\'yxatdan o\'tgan' }, { status: 409 })
    }

    let role: string
    let faculty: string
    let staffInsert: StaffInsert

    if (inviteCode) {
      // ── Taklif kodi orqali ──────────────────────────────────────────────
      // Tarbiyachi kodi bir fakultetga bog'langan (claimed.faculty). Umumiy
      // dekan kodida claimed.faculty = null — dekan fakultetni formada
      // tanlaydi, va shu fakultetda hali faol dekan bo'lmasligi shart.
      const { data: claim, error: claimError } = await supabase.rpc('claim_staff_invite', {
        p_code_hash: hashInviteCode(inviteCode),
      })
      const claimed = Array.isArray(claim) ? claim[0] : claim
      if (claimError || !claimed) {
        return NextResponse.json({ ok: false, error: 'Taklif kodi yaroqsiz yoki muddati tugagan' }, { status: 403 })
      }
      role = String(claimed.role)
      const claimedFaculty = claimed.faculty ? String(claimed.faculty).trim() : ''

      if (claimedFaculty) {
        faculty = claimedFaculty
      } else {
        const picked = typeof body.faculty === 'string' ? body.faculty.trim() : ''
        if (!isPermitFacultyValue(picked)) {
          return NextResponse.json({ ok: false, error: "Fakultet tanlanmagan" }, { status: 400 })
        }
        faculty = picked
        if (role === 'dekan') {
          const { data: existingDekan } = await supabase
            .from('staff')
            .select('id')
            .eq('role', 'dekan')
            .eq('status', 'active')
            .ilike('faculty', faculty)
            .maybeSingle()
          if (existingDekan) {
            return NextResponse.json({ ok: false, error: "Bu fakultet uchun dekan allaqachon ro'yxatdan o'tgan" }, { status: 409 })
          }
        }
      }
      staffInsert = { id: '', email, full_name: fullName, phone_number: phone || null, role, status: 'active', faculty }
    } else {
      // ── Dekan o'zi ro'yxatdan o'tishi (tizim egasi bergan env kalitlar) ──
      role = body.role as StaffRole
      const pickedFaculty = typeof body.faculty === 'string' ? body.faculty.trim() : ''
      const staffId = typeof body.staffId === 'string' ? body.staffId.trim() : ''

      if (role !== 'dekan') {
        return NextResponse.json({ ok: false, error: "Noto'g'ri rol" }, { status: 400 })
      }
      if (!isPermitFacultyValue(pickedFaculty)) {
        return NextResponse.json({ ok: false, error: "Fakultet noto'g'ri tanlangan" }, { status: 400 })
      }
      if (
        !validateStaffLink('dekan', typeof body.linkKey === 'string' ? body.linkKey : '')
        || !validateStaffId(staffId)
        || !validateRegisterCode(typeof body.registerCode === 'string' ? body.registerCode : '')
      ) {
        return NextResponse.json({ ok: false, error: 'Ruxsat rad etildi' }, { status: 403 })
      }
      faculty = pickedFaculty
      // staff_id UNIQUE — allow-list ID'ni saqlash uni bir martalik qiladi.
      staffInsert = { id: '', email, full_name: fullName, phone_number: phone || null, role, status: 'active', faculty, staff_id: staffId }
    }

    const { data: authData, error: authError } = await createAuthUserSafely(email, password, { role })
    if (authError || !authData.user) {
      return NextResponse.json({ ok: false, error: "Ro'yxatdan o'tishda xatolik" }, { status: 400 })
    }

    staffInsert.id = authData.user.id
    const { error: userError } = await supabase.from('staff').insert(staffInsert)

    if (userError) {
      await deleteAuthUserSafely(authData.user.id)
      if (userError.code === '23505') {
        // Partial unique index staff_one_active_dekan_per_faculty — someone
        // else registered as this faculty's dekan in the meantime.
        const dekanRace = /one_active_dekan_per_faculty/.test(userError.message ?? '')
        return NextResponse.json({
          ok: false,
          error: dekanRace
            ? "Bu fakultet uchun dekan allaqachon ro'yxatdan o'tgan"
            : 'Bu email yoki maxsus ID avval ishlatilgan',
        }, { status: 409 })
      }
      console.error('Staff profile insert failed:', userError)
      return NextResponse.json({ ok: false, error: "Xodim profilini yaratib bo'lmadi" }, { status: 400 })
    }

    // A new faculty's dekan gets an app_settings row seeded on the spot, so
    // their dashboard shows THEIR faculty's (blank, default-fee) settings
    // instead of silently falling back to the primary building's numbers.
    // The dekan then fills TTJ name / fees / contacts in /dekan/sozlamalar.
    // ignoreDuplicates: a row already exists if this faculty was set up before.
    if (role === 'dekan') {
      const { error: settingsError } = await supabase
        .from('app_settings')
        .upsert({ faculty }, { onConflict: 'faculty', ignoreDuplicates: true })
      if (settingsError) console.error('app_settings seed for new dekan faculty failed:', settingsError)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatoligi' }, { status: 500 })
  }
}
