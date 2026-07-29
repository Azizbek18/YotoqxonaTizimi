import { NextRequest, NextResponse } from 'next/server'
import { requireFloorCaptain } from '@/server/auth/sardor'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Server xatoligi'
}

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
      return NextResponse.json({ error: elonError.message }, { status: 500 })
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
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const scoped = await requireFloorCaptain(request)
    if (scoped.error) return scoped.error
    const { caller, serviceSupabase } = scoped

    const body = await request.json()
    const { title, text, type } = body

    if (!title || !text) {
      return NextResponse.json({ error: 'Sarlavha va matn talab etiladi' }, { status: 400 })
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
        target_floor: captainFloor,
        target_gender: captainGender,
        created_by: caller.id,
        is_published: true
      })
      .select()
      .single()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, elon: newElon })
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
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

    const { data: id, error } = await serviceSupabase.rpc('upsert_floor_duty_schedule', {
      p_creator_id: caller.id,
      p_floor: caller.assigned_floor,
      p_gender: caller.gender,
      p_faculty: caller.faculty || 'Barchasi',
      p_text: text,
    })
    if (error || !id) {
      return NextResponse.json({ error: error?.message ?? 'Navbatchilik jadvalini saqlab bo‘lmadi' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id })
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
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
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
