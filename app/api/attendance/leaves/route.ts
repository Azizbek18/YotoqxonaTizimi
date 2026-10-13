import { NextRequest, NextResponse } from 'next/server'
import { resolveAttendanceActor } from '@/features/attendance/server/actor'
import { createHomeLeaveService } from '@/features/home-leave/server/service'
import { getServiceSupabase } from '@/lib/server-supabase'
import { getApiError } from '@/server/http/api-error'

/** Sardor / tarbiyachi / dekan: o'z ko'lamidagi uyga ketgan (ketadigan) talabalar. */
export async function GET(request: NextRequest) {
  try {
    const actor = await resolveAttendanceActor(request)
    if (actor.role === 'talaba') {
      return NextResponse.json({ error: 'Bu amal uchun ruxsat yo‘q' }, { status: 403 })
    }
    const leaves = await createHomeLeaveService().listForActor(actor)
    return NextResponse.json({ leaves, canWrite: actor.canWrite })
  } catch (error) {
    const r = getApiError(error, "Arizalarni yuklab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}

/** Aloqa shaxsiga qo'ng'iroq natijasini yozadi: { id, result: 'ok' | 'no_answer' | 'denied' }. */
export async function PATCH(request: NextRequest) {
  try {
    const actor = await resolveAttendanceActor(request)
    const body = (await request.json().catch(() => null)) as { id?: unknown; result?: unknown } | null
    if (!body || typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id)) {
      return NextResponse.json({ error: "Noto'g'ri identifikator" }, { status: 400 })
    }
    const supabase = getServiceSupabase()
    const table = actor.role === 'sardor' ? 'users' : 'staff'
    const { data } = await supabase.from(table).select('full_name').eq('id', actor.userId).maybeSingle()
    const name = (data as { full_name?: string | null } | null)?.full_name ?? (actor.role === 'sardor' ? 'Sardor' : 'Tarbiyachi')
    const leave = await createHomeLeaveService().recordCall(actor, name, body.id, body.result)
    return NextResponse.json({ leave })
  } catch (error) {
    const r = getApiError(error, "Natijani saqlab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
