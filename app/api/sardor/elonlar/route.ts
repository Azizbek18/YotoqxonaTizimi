import { NextRequest, NextResponse } from 'next/server'
import { requireFloorCaptain } from '@/server/auth/sardor'
import { normalizeFaculty, PRIMARY_FACULTY } from '@/lib/faculties'

const ALLOWED_TYPES = new Set(['Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish'])

export async function GET(request: NextRequest) {
  try {
    const scoped = await requireFloorCaptain(request)
    if (scoped.error) return scoped.error
    const { caller, serviceSupabase } = scoped

    const { data: elonlar, error: elonError } = await serviceSupabase
      .from('elonlar')
      .select('*')
      .eq('created_by', caller.id)
      .order('created_at', { ascending: false })

    if (elonError) {
      console.error('Captain announcements lookup failed:', elonError)
      return NextResponse.json({ error: 'E’lonlarni yuklab bo‘lmadi' }, { status: 500 })
    }

    const dutyRow = (elonlar ?? []).find((item) => item.title === 'HAFTALIK_NAVBATCHILIK_JADVALI') ?? null
    let dutySchedule = null
    if (dutyRow?.text) {
      try {
        dutySchedule = { id: dutyRow.id, ...JSON.parse(dutyRow.text) }
      } catch {
        dutySchedule = { id: dutyRow.id, schedule: {}, admins: [] }
      }
    }

    return NextResponse.json({
      ok: true,
      elonlar: (elonlar ?? []).filter((item) => item.title !== 'HAFTALIK_NAVBATCHILIK_JADVALI'),
      dutySchedule,
    })
  } catch (error: unknown) {
    console.error('Captain announcements GET failed:', error)
    return NextResponse.json({ error: 'Server xatoligi' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scoped = await requireFloorCaptain(request)
    if (scoped.error) return scoped.error
    const { caller, serviceSupabase } = scoped

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

    const captainFloor = caller.assigned_floor
    const captainGender = caller.gender

    if (!captainFloor || !captainGender) {
      return NextResponse.json({ error: 'Sardorlik qavati yoki jinsi belgilanmagan' }, { status: 400 })
    }

    const { data: newElon, error: insertError } = await serviceSupabase
      .from('elonlar')
      .insert({
        title,
        text,
        type: type || 'Yangilik',
        audience: 'floor',
        // Stamp the sardor's own faculty so the student-facing floor feed
        // (features/announcements) only shows it inside that building.
        faculty: normalizeFaculty(caller.faculty) ?? PRIMARY_FACULTY,
        target_floor: captainFloor,
        target_gender: captainGender,
        created_by: caller.id,
        is_published: true
      })
      .select()
      .single()

    if (insertError) {
      console.error('Captain announcement insert failed:', insertError)
      return NextResponse.json({ error: 'E’lonni saqlab bo‘lmadi' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, elon: newElon })
  } catch (error: unknown) {
    console.error('Captain announcement POST failed:', error)
    return NextResponse.json({ error: 'Server xatoligi' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const scoped = await requireFloorCaptain(request)
    if (scoped.error) return scoped.error
    const { caller, serviceSupabase } = scoped

    if (!caller.assigned_floor || !caller.gender) {
      return NextResponse.json({ error: 'Sardorlik qavati yoki jinsi belgilanmagan' }, { status: 400 })
    }

    const body = await request.json()
    const schedule = body?.schedule
    const admins = body?.admins
    if (!schedule || typeof schedule !== 'object' || Array.isArray(schedule) || !Array.isArray(admins)) {
      return NextResponse.json({ error: 'Navbatchilik jadvali formati noto‘g‘ri' }, { status: 400 })
    }

    const text = JSON.stringify({ schedule, admins })
    if (text.length > 100_000) {
      return NextResponse.json({ error: 'Navbatchilik jadvali juda katta' }, { status: 413 })
    }

    // The RPC derives the building from the captain's own users.faculty —
    // it is never passed in, so it can't be spoofed.
    const { data: id, error } = await serviceSupabase.rpc('upsert_floor_duty_schedule', {
      p_creator_id: caller.id,
      p_floor: caller.assigned_floor,
      p_gender: caller.gender,
      p_text: text,
    })
    if (error || !id) {
      console.error('Captain duty schedule upsert failed:', error)
      return NextResponse.json({ error: 'Navbatchilik jadvalini saqlab bo‘lmadi' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id })
  } catch (error: unknown) {
    console.error('Captain duty schedule PATCH failed:', error)
    return NextResponse.json({ error: 'Server xatoligi' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scoped = await requireFloorCaptain(request)
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
      console.error('Captain announcement delete failed:', error)
      return NextResponse.json({ error: 'E’lonni o‘chirib bo‘lmadi' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    console.error('Captain announcement DELETE failed:', error)
    return NextResponse.json({ error: 'Server xatoligi' }, { status: 500 })
  }
}
