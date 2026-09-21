import { NextRequest, NextResponse } from 'next/server'
import { requireCouncilChair } from '@/server/auth/council'

// Lets a raisi appoint or demote a qavat sardori (floor captain) among the
// students of their whole faculty, either gender — the same promotion the
// dekan can already do from Talabalar (/api/admin/users), gated behind its
// own revocable right.
export async function PATCH(request: NextRequest) {
  try {
    const scoped = await requireCouncilChair(request, 'captains.manage')
    if (scoped.error) return scoped.error
    const { serviceSupabase, faculty } = scoped

    const body = await request.json()
    const studentId = typeof body?.studentId === 'string' ? body.studentId : ''
    const isCaptain = Boolean(body?.isCaptain)

    if (!studentId) {
      return NextResponse.json({ error: 'studentId talab qilinadi' }, { status: 400 })
    }

    // Fail closed: a raisi may only promote/demote within their own
    // faculty, never reach into another building — re-verified here, not
    // just trusted from the client-sent list.
    const { data: target, error: targetError } = await serviceSupabase
      .from('users')
      .select('id, role, status, faculty, gender, assigned_floor, is_floor_captain')
      .eq('id', studentId)
      .maybeSingle()

    if (targetError || !target || target.role !== 'talaba' || target.status !== 'active') {
      return NextResponse.json({ error: 'Talaba topilmadi' }, { status: 404 })
    }
    if ((target.faculty ?? '').toLowerCase() !== faculty.toLowerCase()) {
      return NextResponse.json(
        { error: 'Boshqa fakultetdagi talabani boshqarib bo‘lmaydi' },
        { status: 403 },
      )
    }

    if (isCaptain) {
      if (!target.assigned_floor || !target.gender) {
        return NextResponse.json(
          { error: "Sardor tayinlash uchun talabaga xona/qavat va jins biriktirilgan bo'lishi shart" },
          { status: 400 },
        )
      }

      // Demoting the previous captain of this (faculty, floor, gender) slot
      // and writing this student's own is_floor_captain happens atomically
      // in the RPC (see 202607280012) — same one /api/admin/users uses. The
      // slot is keyed on the TARGET's own gender, not the raisi's — a raisi
      // now manages both genders, so their own gender is no longer a valid
      // proxy for which floor/gender slot this promotion belongs to.
      const { error: promoteError } = await serviceSupabase.rpc('promote_floor_captain', {
        p_user_id: studentId,
        p_assigned_floor: target.assigned_floor,
        p_gender: target.gender,
        p_is_captain: true,
      })
      if (promoteError) {
        console.error('Council chair captain promotion failed:', promoteError)
        return NextResponse.json({ error: 'Sardor tayinlab bo‘lmadi' }, { status: 500 })
      }
    } else {
      const { error: demoteError } = await serviceSupabase
        .from('users')
        .update({ is_floor_captain: false })
        .eq('id', studentId)
      if (demoteError) {
        console.error('Council chair captain demotion failed:', demoteError)
        return NextResponse.json({ error: 'Sardorlikni olib tashlab bo‘lmadi' }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error('Council chair captain PATCH failed:', error)
    return NextResponse.json({ error: 'Server xatoligi' }, { status: 500 })
  }
}
