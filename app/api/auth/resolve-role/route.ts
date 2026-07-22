import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { getRequestUser } from '@/lib/server-auth'
import { checkRateLimit, getClientIp } from '@/lib/security'

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const throttle = await checkRateLimit(`resolve-role:${ip}`, 30, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ ok: false, error: 'Juda ko\'p urinish. Keyinroq urinib ko\'ring.' }, { status: 429 })
    }

    // Require a verified session and always resolve the role for that
    // session's OWN email — never trust an arbitrary email from the request
    // body, since that would let anyone probe whether any email belongs to
    // an admin/staff account without authenticating at all.
    const requestUser = await getRequestUser(request)
    if (!requestUser?.email) {
      return NextResponse.json({ ok: false, error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })
    }
    const email = requestUser.email.trim().toLowerCase()

    const supabase = getServiceSupabase()
    const { data: staffUser, error: staffError } = await supabase
      .from('staff')
      .select('role, status')
      .eq('email', email)
      .maybeSingle()

    if (staffError) {
      return NextResponse.json({ ok: false, error: staffError.message }, { status: 500 })
    }

    if (staffUser?.status === 'active' && (staffUser.role === 'admin' || staffUser.role === 'tarbiyachi' || staffUser.role === 'zamdekan')) {
      return NextResponse.json({ ok: true, role: staffUser.role })
    }

    const { data: studentUser, error: userError } = await supabase
      .from('users')
      .select('role, status')
      .eq('email', email)
      .maybeSingle()

    if (userError) {
      return NextResponse.json({ ok: false, error: userError.message }, { status: 500 })
    }

    if (studentUser?.role === 'talaba' && studentUser.status === 'active') {
      return NextResponse.json({ ok: true, role: 'talaba' })
    }

    return NextResponse.json({ ok: true, role: null })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatoligi' }, { status: 500 })
  }
}
