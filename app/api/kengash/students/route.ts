import { NextRequest, NextResponse } from 'next/server'
import { requireCouncilChair } from '@/server/auth/council'

// A council chair's scope is their own gender across the WHOLE faculty
// (every floor, every building the faculty holds a room in) — not one
// floor, the way a sardor is scoped. `faculty` + `gender` are resolved and
// validated in requireCouncilChair; a faculty-less or gender-less raisi is
// rejected there, never silently widened.
//
// `?role=captain` narrows the same scope to just the floor captains (a
// raisi represents every sardor in their gender too, not only ordinary
// residents) — same auth, same query shape, one extra filter.
export async function GET(req: NextRequest) {
  try {
    const scoped = await requireCouncilChair(req, 'students.view')
    if (scoped.error) return scoped.error
    const { serviceSupabase, faculty, gender } = scoped
    const captainsOnly = req.nextUrl.searchParams.get('role') === 'captain'

    let query = serviceSupabase
      .from('users')
      .select('id, full_name, email, phone_number, room_number, faculty, course, group, direction, avatar_url, gender, assigned_floor, is_floor_captain')
      .eq('role', 'talaba')
      .eq('status', 'active')
      .ilike('faculty', faculty)
      .eq('gender', gender)
    if (captainsOnly) query = query.eq('is_floor_captain', true)

    const { data: students, error: studentsError } = await query.order('full_name', { ascending: true })

    if (studentsError) {
      console.error('Council chair student lookup failed:', studentsError)
      return NextResponse.json({ error: 'Talabalarni yuklab bo‘lmadi' }, { status: 500 })
    }

    const ids = (students ?? []).map((s) => s.id)
    // How many "ariza" / "tushuntirish" letters each student has filed — the
    // raisi represents them, so this is context they need at a glance, not
    // a document viewer (no title/text is fetched, just a tally).
    const counts = new Map<string, { ariza: number; tushuntirish: number }>()
    if (ids.length > 0) {
      const { data: apps, error: appsError } = await serviceSupabase
        .from('arizalar')
        .select('student_id, type')
        .in('student_id', ids)
        .in('type', ['ariza', 'tushuntirish'])
      if (appsError) {
        console.error('Council chair application tally failed:', appsError)
      } else {
        for (const row of apps ?? []) {
          const id = row.student_id
          if (!id) continue
          const entry = counts.get(id) ?? { ariza: 0, tushuntirish: 0 }
          if (row.type === 'ariza') entry.ariza += 1
          else if (row.type === 'tushuntirish') entry.tushuntirish += 1
          counts.set(id, entry)
        }
      }
    }

    const withCounts = (students ?? []).map((s) => ({
      ...s,
      arizaCount: counts.get(s.id)?.ariza ?? 0,
      tushuntirishCount: counts.get(s.id)?.tushuntirish ?? 0,
    }))

    return NextResponse.json({ ok: true, students: withCounts, gender })
  } catch (error: unknown) {
    console.error('Council chair students GET failed:', error)
    return NextResponse.json({ error: 'Server xatoligi' }, { status: 500 })
  }
}
