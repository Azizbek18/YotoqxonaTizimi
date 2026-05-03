import { NextResponse } from 'next/server'
import { validateStaffId, validateStaffLink, type StaffRole } from '@/lib/staff-access'
import { checkRateLimit, getClientIp } from '@/lib/security'

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request)
    const throttle = checkRateLimit(`staff-access:${ip}`, 20, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ ok: false, error: 'Juda ko\'p urinish. Keyinroq urinib ko\'ring.' }, { status: 429 })
    }

    const body = await request.json()
    const role = body.role as StaffRole
    const staffId = typeof body.staffId === 'string' ? body.staffId : ''
    const linkKey = typeof body.linkKey === 'string' ? body.linkKey : ''

    if (role !== 'admin' && role !== 'tarbiyachi') {
      return NextResponse.json({ ok: false, error: "Noto'g'ri rol" }, { status: 400 })
    }

    const linkOk = validateStaffLink(role, linkKey)
    const idOk = validateStaffId(role, staffId)

    if (!linkOk || !idOk) {
      return NextResponse.json({ ok: false, error: 'Ruxsat rad etildi' }, { status: 403 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'So\'rovda xatolik' }, { status: 400 })
  }
}
