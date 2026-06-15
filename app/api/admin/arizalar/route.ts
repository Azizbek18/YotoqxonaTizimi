import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/server-admin'
import { getServiceSupabase } from '@/lib/server-supabase'

type ApplicationLevel = 'info' | 'warning' | 'critical'

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function GET() {
  try {
    const { session, isAdmin } = await getAdminSession()

    if (!session?.user?.id) {
      return jsonError('Autentifikatsiya talab qilinadi', 401)
    }

    if (!isAdmin) {
      return jsonError('Admin huquqi talab qilinadi', 403)
    }

    const supabase = getServiceSupabase()
    const { data: requests, error } = await supabase
      .from('arizalar')
      .select('id, student_name, text, level, status, created_at')
      .neq('status', 'draft')
      .order('created_at', { ascending: false })

    if (error) {
      return jsonError(error.message, 500)
    }

    const formatted = (requests ?? []).map((request) => ({
      id: String(request.id),
      student_name: request.student_name ?? 'Noma\'lum',
      text: request.text ?? '',
      level: (request.level ?? 'info') as ApplicationLevel,
      status: request.status ?? 'pending',
      created_at: request.created_at ?? null,
      updated_at: null,
    }))

    return NextResponse.json({ ok: true, requests: formatted })
  } catch (error) {
    console.error('Admin arizalar GET xato:', error)
    return jsonError('Arizalarni yuklashda server xatosi yuz berdi', 500)
  }
}

export async function PATCH(request: Request) {
  try {
    const { session, isAdmin } = await getAdminSession()

    if (!session?.user?.id) {
      return jsonError('Autentifikatsiya talab qilinadi', 401)
    }

    if (!isAdmin) {
      return jsonError('Admin huquqi talab qilinadi', 403)
    }

    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const level = body.level as ApplicationLevel | undefined
    const status = body.status as string | undefined

    if (!id) {
      return jsonError("So'rov ma'lumotlari noto'g'ri", 400)
    }

    const updateFields: any = {}
    if (level !== undefined) updateFields.level = level
    if (status !== undefined) {
      updateFields.status = status
      if (status !== 'pending') {
        updateFields.response_date = new Date().toISOString()
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return jsonError("Yangilash uchun ma'lumot yo'q", 400)
    }

    const supabase = getServiceSupabase()
    const { error } = await supabase
      .from('arizalar')
      .update(updateFields)
      .eq('id', id)

    if (error) {
      return jsonError(error.message, 400)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin arizalar PATCH xato:', error)
    return jsonError('Ariza holatini yangilashda server xatosi yuz berdi', 500)
  }
}

export async function DELETE(request: Request) {
  try {
    const { session, isAdmin } = await getAdminSession()

    if (!session?.user?.id) {
      return jsonError('Autentifikatsiya talab qilinadi', 401)
    }

    if (!isAdmin) {
      return jsonError('Admin huquqi talab qilinadi', 403)
    }

    const body = await request.json()
    const id = typeof body.id === 'string' ? body.id : ''

    if (!id) {
      return jsonError("So'rov ma'lumotlari noto'g'ri", 400)
    }

    const supabase = getServiceSupabase()
    const { error } = await supabase
      .from('arizalar')
      .delete()
      .eq('id', id)

    if (error) {
      return jsonError(error.message, 400)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Admin arizalar DELETE xato:', error)
    return jsonError('Arizani o‘chirishda server xatosi yuz berdi', 500)
  }
}
