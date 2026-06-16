import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/server-admin'
import { getServiceSupabase } from '@/lib/server-supabase'

export async function POST(request: Request) {
  try {
    const { session, isAdmin } = await getAdminSession()

    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })
    }

    if (!isAdmin) {
      return NextResponse.json({ ok: false, error: 'Admin huquqi talab qilinadi' }, { status: 403 })
    }

    const body = await request.json()
    const student_id = typeof body.student_id === 'string' ? body.student_id.trim() : ''
    const message = typeof body.message === 'string' ? body.message.trim() : ''

    if (!student_id || !message) {
      return NextResponse.json({ ok: false, error: "So'rov ma'lumotlari noto'g'ri" }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const { data, error } = await supabase
      .from('arizalar')
      .insert({
        student_id,
        type: 'chat',
        title: 'admin',
        reason: message,
        status: 'submitted'
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, message: data })
  } catch (error) {
    console.error('Admin chat POST error:', error)
    return NextResponse.json({ ok: false, error: 'Xatolik yuz berdi' }, { status: 500 })
  }
}
