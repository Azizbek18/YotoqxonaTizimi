import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { getRequestUser } from '@/lib/server-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const throttle = await checkRateLimit(`resolve-role:${ip}`, 30, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json(
        { ok: false, error: 'Juda ko‘p urinish. Keyinroq urinib ko‘ring.' },
        { status: 429 },
      )
    }

    const requestUser = await getRequestUser(request)
    if (!requestUser?.id || !requestUser.email) {
      return NextResponse.json(
        { ok: false, error: 'Autentifikatsiya talab qilinadi' },
        { status: 401 },
      )
    }
    const email = requestUser.email.trim().toLowerCase()
    const supabase = getServiceSupabase()

    const { data: staffUser, error: staffError } = await supabase
      .from('staff')
      .select('role, status')
      .eq('email', email)
      .maybeSingle()
    if (staffError) {
      console.error('Role resolution staff lookup failed:', staffError)
      return NextResponse.json(
        { ok: false, error: 'Rolni aniqlab bo‘lmadi' },
        { status: 500 },
      )
    }

    if (
      staffUser?.status === 'active'
      && ['admin', 'tarbiyachi', 'dekan'].includes(staffUser.role)
    ) {
      return NextResponse.json({ ok: true, role: staffUser.role })
    }

    const { data: initialStudentUser, error: userError } = await supabase
      .from('users')
      .select('role, status, is_off_campus')
      .eq('id', requestUser.id)
      .maybeSingle()
    if (userError) {
      console.error('Role resolution student lookup failed:', userError)
      return NextResponse.json(
        { ok: false, error: 'Rolni aniqlab bo‘lmadi' },
        { status: 500 },
      )
    }
    let studentUser = initialStudentUser

    // A KV-talaba (off-campus student) never has a permit_requests row, so
    // activate_pending_student (permit-anchored) would only ever no-op for
    // them — skip it outright and let the reason below name the real cause
    // (dekan hasn't approved yet), not a misleading "email not verified".
    if (studentUser?.role === 'talaba' && studentUser.status === 'pending' && !studentUser.is_off_campus) {
      const { data: activated, error: activationError } = await supabase.rpc(
        'activate_pending_student',
        { p_user_id: requestUser.id, p_email: email },
      )
      if (activationError) {
        console.error('Pending student activation failed:', activationError)
        return NextResponse.json(
          { ok: false, error: 'Akkauntni faollashtirib bo‘lmadi' },
          { status: 500 },
        )
      }
      if (activated) {
        studentUser = { role: 'talaba', status: 'active', is_off_campus: false }
      }
    }

    if (studentUser?.role === 'talaba' && studentUser.status === 'active') {
      return NextResponse.json({ ok: true, role: 'talaba' })
    }

    // The caller is already authenticated, so naming their own account state
    // is not enumeration — and "pending" is the one case a student can fix
    // themselves (finish the emailed confirmation link, or wait for dekan
    // approval if they're a KV-talaba).
    const reason = studentUser?.role === 'talaba' && studentUser.status === 'pending'
      ? (studentUser.is_off_campus ? 'awaiting_dean_approval' : 'email_not_verified')
      : 'no_role'
    return NextResponse.json({ ok: true, role: null, reason })
  } catch (error) {
    console.error('Role resolution failed:', error)
    return NextResponse.json({ ok: false, error: 'Server xatoligi' }, { status: 500 })
  }
}
