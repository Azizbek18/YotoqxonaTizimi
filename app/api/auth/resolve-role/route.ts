import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const throttle = checkRateLimit(`resolve-role:${ip}`, 30, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ ok: false, error: 'Juda ko\'p urinish. Keyinroq urinib ko\'ring.' }, { status: 429 })
    }

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''

    if (!email) {
      return NextResponse.json({ ok: false, error: 'Email talab qilinadi' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const { data: staffUser, error: staffError } = await supabase
      .from('staff')
      .select('role')
      .eq('email', email)
      .maybeSingle()

    if (staffError) {
      return NextResponse.json({ ok: false, error: staffError.message }, { status: 500 })
    }

    if (staffUser?.role === 'admin' || staffUser?.role === 'tarbiyachi' || staffUser?.role === 'zamdekan') {
      return NextResponse.json({ ok: true, role: staffUser.role })
    }

    const { data: studentUser, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('email', email)
      .maybeSingle()

    if (userError) {
      return NextResponse.json({ ok: false, error: userError.message }, { status: 500 })
    }

    if (studentUser?.role === 'talaba') {
      return NextResponse.json({ ok: true, role: 'talaba' })
    }

    return NextResponse.json({ ok: true, role: null })
  } catch {
    return NextResponse.json({ ok: false, error: 'Server xatoligi' }, { status: 500 })
  }
}
