import { NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/server-admin'
import { getServiceSupabase } from '@/lib/server-supabase'
import type { Database } from '@/types/database.generated'

type ElonType = 'Muhim' | 'Tadbir' | 'Yangilik' | 'Ogohlantirish'

const ALLOWED_TYPES: ElonType[] = ['Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish']

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

async function requireAdmin() {
  const session = await getAdminSession()
  if (!session.isAdmin) {
    return null
  }
  return session
}

export async function GET() {
  const adminSession = await requireAdmin()
  if (!adminSession) {
    return jsonError('Admin huquqi kerak', 403)
  }

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('elonlar')
    .select('id, title, text, type, audience, faculty, is_published, created_by, created_at, updated_at, published_at')
    .order('created_at', { ascending: false })

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json({ elonlar: data ?? [] })
}

export async function POST(request: Request) {
  const adminSession = await requireAdmin()
  if (!adminSession) {
    return jsonError('Admin huquqi kerak', 403)
  }

  const body = await request.json().catch(() => null)
  const title = String(body?.title ?? '').trim()
  const text = String(body?.text ?? '').trim()
  const type = String(body?.type ?? 'Yangilik') as ElonType
  const audience = body?.audience === 'faculty' ? 'faculty' : 'all'
  const faculty = audience === 'faculty' ? String(body?.faculty ?? '').trim() : null
  const isPublished = body?.is_published !== false

  if (title.length < 3) {
    return jsonError("Sarlavha kamida 3 ta belgidan iborat bo'lishi kerak", 400)
  }

  if (text.length < 5) {
    return jsonError("Xabar matni kamida 5 ta belgidan iborat bo'lishi kerak", 400)
  }

  if (!ALLOWED_TYPES.includes(type)) {
    return jsonError("E'lon turi noto'g'ri", 400)
  }

  if (audience === 'faculty' && !faculty) {
    return jsonError('Fakultet tanlanishi kerak', 400)
  }

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('elonlar')
    .insert({
      title,
      text,
      type,
      audience,
      faculty,
      is_published: isPublished,
      created_by: adminSession.session?.user.id ?? null,
      published_at: isPublished ? new Date().toISOString() : null,
    })
    .select('id, title, text, type, audience, faculty, is_published, created_at, updated_at, published_at')
    .single()

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json({ elon: data }, { status: 201 })
}

export async function PATCH(request: Request) {
  const adminSession = await requireAdmin()
  if (!adminSession) {
    return jsonError('Admin huquqi kerak', 403)
  }

  const body = await request.json().catch(() => null)
  const id = String(body?.id ?? '').trim()

  if (!id) {
    return jsonError("E'lon ID topilmadi", 400)
  }

  const updates: Database['public']['Tables']['elonlar']['Update'] = {}

  if (body?.title !== undefined) {
    const title = String(body.title).trim()
    if (title.length < 3) return jsonError("Sarlavha kamida 3 ta belgidan iborat bo'lishi kerak", 400)
    updates.title = title
  }

  if (body?.text !== undefined) {
    const text = String(body.text).trim()
    if (text.length < 5) return jsonError("Xabar matni kamida 5 ta belgidan iborat bo'lishi kerak", 400)
    updates.text = text
  }

  if (body?.type !== undefined) {
    const type = String(body.type) as ElonType
    if (!ALLOWED_TYPES.includes(type)) return jsonError("E'lon turi noto'g'ri", 400)
    updates.type = type
  }

  if (body?.audience !== undefined) {
    updates.audience = body.audience === 'faculty' ? 'faculty' : 'all'
  }

  if (body?.faculty !== undefined) {
    updates.faculty = String(body.faculty).trim() || null
  }

  if (body?.is_published !== undefined) {
    updates.is_published = Boolean(body.is_published)
    if (Boolean(body.is_published)) {
      updates.published_at = new Date().toISOString()
    }
  }

  const supabase = getServiceSupabase()
  const { data, error } = await supabase
    .from('elonlar')
    .update(updates)
    .eq('id', id)
    .select('id, title, text, type, audience, faculty, is_published, created_at, updated_at, published_at')
    .single()

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json({ elon: data })
}

export async function DELETE(request: Request) {
  const adminSession = await requireAdmin()
  if (!adminSession) {
    return jsonError('Admin huquqi kerak', 403)
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return jsonError("E'lon ID topilmadi", 400)
  }

  const supabase = getServiceSupabase()
  const { error } = await supabase.from('elonlar').delete().eq('id', id)

  if (error) {
    return jsonError(error.message, 500)
  }

  return NextResponse.json({ ok: true })
}
