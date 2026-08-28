import { NextRequest, NextResponse } from 'next/server'
import { requireScopedTarbiyachi } from '@/server/auth/tarbiyachi'
import { normalizeFaculty } from '@/lib/faculties'

type ApplicationLevel = 'info' | 'warning' | 'critical'

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status })
}

export async function GET(req: NextRequest) {
  try {
    const scoped = await requireScopedTarbiyachi(req)
    if (scoped.error) return scoped.error
    const { serviceSupabase, faculty } = scoped

    // arizalar carries a faculty column (Bosqich 2a) — scope straight to it.
    const { data: requests, error } = await serviceSupabase
      .from('arizalar')
      .select('id, student_id, student_name, text, type, level, status, created_at, response_date')
      .ilike('faculty', faculty)
      .in('type', ['ariza', 'tushuntirish'])
      .neq('status', 'draft')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Scoped staff applications lookup failed:', error)
      return jsonError('Arizalarni yuklab bo‘lmadi', 500)
    }

    const formatted = (requests ?? []).map((request) => ({
      id: String(request.id),
      student_name: request.student_name ?? "Noma'lum",
      text: request.text ?? '',
      type: request.type ?? 'ariza',
      level: (request.level ?? 'info') as ApplicationLevel,
      status: request.status ?? 'pending',
      created_at: request.created_at ?? null,
      response_date: request.response_date ?? null,
    }))

    return NextResponse.json({ ok: true, requests: formatted, scope: { faculty } })
  } catch (error) {
    console.error('Staff arizalar GET xato:', error)
    return jsonError('Arizalarni yuklashda server xatosi yuz berdi', 500)
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const scoped = await requireScopedTarbiyachi(req)
    if (scoped.error) return scoped.error
    const { serviceSupabase, faculty } = scoped

    const body = await req.json()
    const id = typeof body.id === 'string' ? body.id : ''
    const status = typeof body.status === 'string' ? body.status : undefined

    if (!id) {
      return jsonError("So'rov ma'lumotlari noto'g'ri", 400)
    }

    // Staff may only decide a pending application one way or the other —
    // never set it to 'draft'/'submitted' (student-only states) and never
    // re-open or flip an already-decided one after the fact.
    if (status !== 'approved' && status !== 'rejected') {
      return jsonError("Status faqat 'approved' yoki 'rejected' bo'lishi mumkin", 400)
    }

    // Only an ariza from this tarbiyachi's faculty may be decided.
    const { data: existing, error: fetchError } = await serviceSupabase
      .from('arizalar')
      .select('faculty')
      .eq('id', id)
      .maybeSingle<{ faculty: string | null }>()

    if (fetchError) {
      console.error('Scoped staff application lookup failed:', fetchError)
      return jsonError('Arizani tekshirib bo‘lmadi', 500)
    }
    if (!existing) {
      return jsonError('Ariza topilmadi', 404)
    }
    if ((normalizeFaculty(existing.faculty) ?? '') !== faculty) {
      return jsonError('Ushbu arizani boshqarish huquqingiz yo\'q', 403)
    }

    const { data: updated, error } = await serviceSupabase
      .from('arizalar')
      .update({ status, response_date: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'pending')
      .ilike('faculty', faculty)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error('Scoped staff application update failed:', error)
      return jsonError('Ariza holatini yangilab bo‘lmadi', 500)
    }
    if (!updated) {
      return jsonError('Bu ariza allaqachon ko\'rib chiqilgan', 409)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Staff arizalar PATCH xato:', error)
    return jsonError('Ariza holatini yangilashda server xatosi yuz berdi', 500)
  }
}
