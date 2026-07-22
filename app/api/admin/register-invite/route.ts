import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { writeAuditLog } from '@/lib/audit-log'
import { createHash } from 'crypto'

export async function POST(request: NextRequest) {
  const throttle = await checkRateLimit(`admin-register:${getClientIp(request)}`, 5, 15 * 60_000)
  if (!throttle.allowed) return NextResponse.json({ error: 'Juda ko‘p urinish.' }, { status: 429 })

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    const name = String(body?.name ?? '').trim().slice(0, 160)
    const email = String(body?.email ?? '').trim().toLowerCase().slice(0, 254)
    const password = String(body?.password ?? '')
    const inviteCode = String(body?.inviteCode ?? '').trim().slice(0, 128)
    if (name.length < 3 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || !inviteCode) {
      return NextResponse.json({ error: 'Kiritilgan ma’lumotlar talabga javob bermaydi.' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const tokenHash = createHash('sha256').update(inviteCode).digest('hex')
    const { data: invite, error: inviteError } = await supabase
      .from('admin_invites')
      .select('id, used, expires_at')
      .eq('token_hash', tokenHash)
      .eq('email', email)
      .maybeSingle()
    if (inviteError || !invite || invite.used || new Date(invite.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Taklif kodi noto‘g‘ri, ishlatilgan yoki email bilan mos emas.' }, { status: 403 })
    }

    // Claim before creating the account. Returning the updated row makes a
    // zero-row concurrent update distinguishable from a successful claim.
    const claimedAt = new Date().toISOString()
    const { data: claimed, error: claimError } = await supabase
      .from('admin_invites')
      .update({ used: true, used_at: claimedAt })
      .eq('id', invite.id)
      .eq('used', false)
      .gt('expires_at', claimedAt)
      .select('id')
      .maybeSingle()
    if (claimError || !claimed) {
      return NextResponse.json({ error: 'Taklif kodi boshqa so‘rovda ishlatilgan.' }, { status: 409 })
    }

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin' },
    })
    if (authError || !authData.user) {
      await supabase.from('admin_invites').update({ used: false, used_at: null }).eq('id', invite.id).eq('used_at', claimedAt)
      return NextResponse.json({ error: 'Admin akkauntini yaratib bo‘lmadi.' }, { status: 400 })
    }

    const { error: staffError } = await supabase.from('staff').insert({
      id: authData.user.id,
      email,
      full_name: name,
      staff_id: `ADMIN-${authData.user.id.slice(0, 8)}`,
      role: 'admin',
      status: 'active',
    })
    if (staffError) {
      await supabase.auth.admin.deleteUser(authData.user.id)
      await supabase.from('admin_invites').update({ used: false, used_at: null }).eq('id', invite.id).eq('used_at', claimedAt)
      throw staffError
    }

    await writeAuditLog({
      eventType: 'admin.registered_with_invite',
      status: 'success',
      ipAddress: getClientIp(request),
      actorUserId: authData.user.id,
      targetRole: 'admin',
    })
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (error) {
    console.error('Invited admin registration failed:', error)
    return NextResponse.json({ error: 'Server xatoligi yuz berdi.' }, { status: 500 })
  }
}
