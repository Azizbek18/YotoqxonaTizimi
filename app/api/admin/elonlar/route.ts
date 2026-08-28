import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { requireActiveStaff } from '@/server/auth/guards'
import { staffFacultyOrPrimary } from '@/server/auth/faculty'
import { getApiError } from '@/server/http/api-error'
import { checkRateLimit } from '@/lib/security'
import type { Database } from '@/types/database.generated'

type ElonType = 'Muhim' | 'Tadbir' | 'Yangilik' | 'Ogohlantirish'

const ALLOWED_TYPES: ElonType[] = ['Muhim', 'Tadbir', 'Yangilik', 'Ogohlantirish']
const COLUMNS = 'id, title, text, type, audience, faculty, is_published, created_by, created_at, updated_at, published_at'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

function errorResponse(error: unknown, fallback: string) {
  console.error('Admin announcements API error:', error)
  const response = getApiError(error, fallback)
  return NextResponse.json(response.body, { status: response.status })
}

// The admin panel is the primary faculty's (amit) staff view; a dekan reaches
// it too (proxy allows ['admin','dekan']). Either way the caller only ever
// sees, creates and edits announcements of THEIR OWN faculty — the faculty is
// taken from staff.faculty, never from the request body.
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = staffFacultyOrPrimary(staff.faculty)

    const { data, error } = await getServiceSupabase()
      .from('elonlar')
      .select(COLUMNS)
      .ilike('faculty', faculty)
      .in('audience', ['all', 'faculty'])
      .neq('title', 'HAFTALIK_NAVBATCHILIK_JADVALI')
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ elonlar: data ?? [] })
  } catch (error) {
    return errorResponse(error, "E'lonlarni yuklab bo'lmadi")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, staff } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = staffFacultyOrPrimary(staff.faculty)

    const throttle = await checkRateLimit(`admin-elon:${user.id}`, 20, 60_000)
    if (!throttle.allowed) {
      return jsonError("Juda ko'p urinish. Keyinroq urinib ko'ring.", 429)
    }

    const body = await request.json().catch(() => null)
    const title = String(body?.title ?? '').trim()
    const text = String(body?.text ?? '').trim()
    const type = String(body?.type ?? 'Yangilik') as ElonType
    // 'all' = shu fakultet binosidagi barchaga; 'faculty' = fakultet e'loni.
    // Ikkalasi ham o'qishda fakultet bo'yicha filtrlanadi (leak yo'q).
    const audience = body?.audience === 'faculty' ? 'faculty' : 'all'
    const isPublished = body?.is_published !== false

    if (title.length < 3 || title.length > 160) {
      return jsonError("Sarlavha 3–160 belgidan iborat bo'lishi kerak", 400)
    }
    if (text.length < 5 || text.length > 20_000) {
      return jsonError("Xabar matni 5–20000 belgidan iborat bo'lishi kerak", 400)
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return jsonError("E'lon turi noto'g'ri", 400)
    }

    const { data, error } = await getServiceSupabase()
      .from('elonlar')
      .insert({
        title,
        text,
        type,
        audience,
        faculty,
        is_published: isPublished,
        created_by: user.id,
        published_at: isPublished ? new Date().toISOString() : null,
      })
      .select(COLUMNS)
      .single()

    if (error) throw error
    return NextResponse.json({ elon: data }, { status: 201 })
  } catch (error) {
    return errorResponse(error, "E'lonni saqlab bo'lmadi")
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = staffFacultyOrPrimary(staff.faculty)

    const body = await request.json().catch(() => null)
    const id = String(body?.id ?? '').trim()
    if (!id) return jsonError("E'lon ID topilmadi", 400)

    // Deliberately NOT updatable: audience and faculty. Re-targeting an
    // announcement to another faculty (or flipping its audience) is exactly
    // the cross-tenant move this route must not allow.
    const updates: Database['public']['Tables']['elonlar']['Update'] = {}

    if (body?.title !== undefined) {
      const title = String(body.title).trim()
      if (title.length < 3 || title.length > 160) return jsonError("Sarlavha 3–160 belgidan iborat bo'lishi kerak", 400)
      updates.title = title
    }
    if (body?.text !== undefined) {
      const text = String(body.text).trim()
      if (text.length < 5 || text.length > 20_000) return jsonError("Xabar matni 5–20000 belgidan iborat bo'lishi kerak", 400)
      updates.text = text
    }
    if (body?.type !== undefined) {
      const type = String(body.type) as ElonType
      if (!ALLOWED_TYPES.includes(type)) return jsonError("E'lon turi noto'g'ri", 400)
      updates.type = type
    }
    if (body?.is_published !== undefined) {
      updates.is_published = Boolean(body.is_published)
      if (Boolean(body.is_published)) updates.published_at = new Date().toISOString()
    }

    if (Object.keys(updates).length === 0) return jsonError("Yangilash uchun ma'lumot yo'q", 400)

    const { data, error } = await getServiceSupabase()
      .from('elonlar')
      .update(updates)
      .eq('id', id)
      .ilike('faculty', faculty)
      .in('audience', ['all', 'faculty'])
      .select(COLUMNS)
      .maybeSingle()

    if (error) throw error
    if (!data) return jsonError("E'lon topilmadi", 404)
    return NextResponse.json({ elon: data })
  } catch (error) {
    return errorResponse(error, "E'lonni yangilab bo'lmadi")
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan'])
    const faculty = staffFacultyOrPrimary(staff.faculty)

    const id = request.nextUrl.searchParams.get('id')?.trim()
    if (!id) return jsonError("E'lon ID topilmadi", 400)

    const { data, error } = await getServiceSupabase()
      .from('elonlar')
      .delete()
      .eq('id', id)
      .ilike('faculty', faculty)
      .in('audience', ['all', 'faculty'])
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) return jsonError("E'lon topilmadi", 404)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error, "E'lonni o'chirib bo'lmadi")
  }
}
