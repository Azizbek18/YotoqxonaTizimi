import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/server-admin'
import { getServiceSupabase } from '@/lib/server-supabase'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Server xatoligi'
}

export async function GET() {
  try {
    const authSupabase = await createServerSupabaseClient()
    const serviceSupabase = getServiceSupabase()
    const {
      data: { session },
    } = await authSupabase.auth.getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })
    }

    // Fetch caller profile
    const { data: caller, error: callerError } = await serviceSupabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (callerError || !caller || !caller.is_floor_captain) {
      return NextResponse.json({ error: 'Siz qavat sardori emassiz' }, { status: 403 })
    }

    const { data: elonlar, error: elonError } = await serviceSupabase
      .from('elonlar')
      .select('*')
      .eq('created_by', caller.id)
      .order('created_at', { ascending: false })

    if (elonError) {
      return NextResponse.json({ error: elonError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, elonlar: elonlar ?? [] })
  } catch (error: unknown) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const authSupabase = await createServerSupabaseClient()
    const serviceSupabase = getServiceSupabase()
    const {
      data: { session },
    } = await authSupabase.auth.getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })
    }

    // Fetch caller profile
    const { data: caller, error: callerError } = await serviceSupabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (callerError || !caller || !caller.is_floor_captain) {
      return NextResponse.json({ error: 'Siz qavat sardori emassiz' }, { status: 403 })
    }

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

export async function DELETE(request: Request) {
  try {
    const authSupabase = await createServerSupabaseClient()
    const serviceSupabase = getServiceSupabase()
    const {
      data: { session },
    } = await authSupabase.auth.getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })
    }

    // Fetch caller profile
    const { data: caller, error: callerError } = await serviceSupabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (callerError || !caller || !caller.is_floor_captain) {
      return NextResponse.json({ error: 'Siz qavat sardori emassiz' }, { status: 403 })
    }

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
