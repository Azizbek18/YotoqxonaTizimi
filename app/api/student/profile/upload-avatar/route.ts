import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { PERMIT_FILE_RULES, hasAllowedSignature } from '@/lib/permit-validation'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function pathFromPublicAvatarUrl(url: string | null | undefined) {
  if (!url) return null
  try {
    const marker = '/storage/v1/object/public/avatar/'
    const pathname = new URL(url).pathname
    const index = pathname.indexOf(marker)
    return index >= 0 ? decodeURIComponent(pathname.slice(index + marker.length)) : null
  } catch {
    return null
  }
}

async function requireStudent(request: NextRequest) {
  const { user, student } = await requireActiveStudent(request)
  const supabase = getServiceSupabase()
  const { data: profile, error } = await supabase
    .from('users')
    .select('id, avatar_url')
    .eq('id', student.id)
    .eq('role', 'talaba')
    .maybeSingle()
  if (error) throw error
  return { user, profile: profile ?? { id: student.id, avatar_url: null }, supabase }
}

function errorResponse(error: unknown, fallback: string) {
  const response = getApiError(error, fallback)
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireStudent(request)
    return NextResponse.json({ success: true, avatar_url: context.profile.avatar_url })
  } catch (error) {
    return errorResponse(error, 'Avatarni yuklab bo\'lmadi')
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireStudent(request)

    const form = await request.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'Fayl topilmadi' }, { status: 400 })
    if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size < 16 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Faqat JPEG, PNG yoki WEBP (5 MB gacha) qabul qilinadi' }, { status: 400 })
    }

    const rule = PERMIT_FILE_RULES[file.type]
    const buffer = Buffer.from(await file.arrayBuffer())
    if (!rule || !hasAllowedSignature(buffer, rule.signatures)) {
      return NextResponse.json({ error: 'Fayl tarkibi e’lon qilingan rasm formatiga mos emas' }, { status: 400 })
    }
    if (file.type === 'image/webp' && buffer.subarray(8, 12).toString('ascii') !== 'WEBP') {
      return NextResponse.json({ error: 'WEBP fayl imzosi noto‘g‘ri' }, { status: 400 })
    }

    const path = `${context.user.id}/${randomUUID()}.${rule.extension}`
    const { error: uploadError } = await context.supabase.storage.from('avatar').upload(path, buffer, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    })
    if (uploadError) throw uploadError

    const publicUrl = context.supabase.storage.from('avatar').getPublicUrl(path).data.publicUrl
    const { error: updateError } = await context.supabase
      .from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', context.user.id)
      .eq('role', 'talaba')
    if (updateError) {
      await context.supabase.storage.from('avatar').remove([path])
      throw updateError
    }

    const oldPath = pathFromPublicAvatarUrl(context.profile.avatar_url)
    if (oldPath && oldPath.startsWith(`${context.user.id}/`)) {
      await context.supabase.storage.from('avatar').remove([oldPath])
    }
    return NextResponse.json({ success: true, url: publicUrl, avatar_url: publicUrl, message: 'Rasm muvaffaqiyatli yuklandi' })
  } catch (error) {
    console.error('Avatar upload xatosi:', error)
    return errorResponse(error, 'Avatarni saqlashda server xatoligi')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requireStudent(request)

    const oldPath = pathFromPublicAvatarUrl(context.profile.avatar_url)
    const { error } = await context.supabase
      .from('users')
      .update({ avatar_url: null })
      .eq('id', context.user.id)
      .eq('role', 'talaba')
    if (error) throw error

    if (oldPath && oldPath.startsWith(`${context.user.id}/`)) {
      await context.supabase.storage.from('avatar').remove([oldPath])
    }
    return NextResponse.json({ success: true, message: 'Avatar muvaffaqiyatli o‘chirildi' })
  } catch (error) {
    console.error('Avatar delete xatosi:', error)
    return errorResponse(error, 'Avatarni o‘chirishda server xatoligi')
  }
}
