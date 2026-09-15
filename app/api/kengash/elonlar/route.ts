import { NextRequest, NextResponse } from 'next/server'
import { requireCouncilChair } from '@/server/auth/council'

const ALLOWED_TYPES = new Set(['Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish'])

// Ungated read, same reasoning as /api/sardor/elonlar: a raisi who has lost
// the write permission should still get a panel that loads and shows their
// past announcements, not a 403 wall.
export async function GET(request: NextRequest) {
  try {
    const scoped = await requireCouncilChair(request)
    if (scoped.error) return scoped.error
    const { caller, serviceSupabase } = scoped

    const { data: elonlar, error } = await serviceSupabase
      .from('elonlar')
      .select('*')
      .eq('created_by', caller.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Council chair announcements lookup failed:', error)
      return NextResponse.json({ error: 'E’lonlarni yuklab bo‘lmadi' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, elonlar: elonlar ?? [] })
  } catch (error: unknown) {
    console.error('Council chair announcements GET failed:', error)
    return NextResponse.json({ error: 'Server xatoligi' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scoped = await requireCouncilChair(request, 'council.announcements')
    if (scoped.error) return scoped.error
    const { caller, serviceSupabase, faculty, gender } = scoped

    const body = await request.json()
    const title = typeof body?.title === 'string' ? body.title.trim() : ''
    const text = typeof body?.text === 'string' ? body.text.trim() : ''
    const type = typeof body?.type === 'string' ? body.type : 'Yangilik'

    if (title.length < 3 || title.length > 160 || text.length < 5 || text.length > 20_000) {
      return NextResponse.json({ error: 'Sarlavha yoki matn uzunligi noto‘g‘ri' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: 'E’lon turi noto‘g‘ri' }, { status: 400 })
    }

    const { data: newElon, error: insertError } = await serviceSupabase
      .from('elonlar')
      .insert({
        title,
        text,
        type: type || 'Yangilik',
        audience: 'council',
        // Stamped faculty + gender, no floor — reaches every same-gender
        // student in the faculty, not one building floor.
        faculty,
        target_floor: null,
        target_gender: gender,
        created_by: caller.id,
        is_published: true,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Council chair announcement insert failed:', insertError)
      return NextResponse.json({ error: 'E’lonni saqlab bo‘lmadi' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, elon: newElon })
  } catch (error: unknown) {
    console.error('Council chair announcement POST failed:', error)
    return NextResponse.json({ error: 'Server xatoligi' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scoped = await requireCouncilChair(request, 'council.announcements')
    if (scoped.error) return scoped.error
    const { caller, serviceSupabase } = scoped

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'ID talab qilinadi' }, { status: 400 })
    }

    const { error } = await serviceSupabase
      .from('elonlar')
      .delete()
      .eq('id', id)
      .eq('created_by', caller.id)

    if (error) {
      console.error('Council chair announcement delete failed:', error)
      return NextResponse.json({ error: 'E’lonni o‘chirib bo‘lmadi' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error('Council chair announcement DELETE failed:', error)
    return NextResponse.json({ error: 'Server xatoligi' }, { status: 500 })
  }
}
