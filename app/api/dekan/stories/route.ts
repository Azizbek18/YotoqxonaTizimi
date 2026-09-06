import { randomUUID } from 'crypto'
import { NextRequest, NextResponse, after } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { PERMIT_FILE_RULES, hasAllowedSignature } from '@/lib/permit-validation'
import { readMultipartForm, MAX_UPLOAD_SIZE_BYTES } from '@/lib/upload-limits'
import { checkRateLimit } from '@/lib/security'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { createStoryService } from '@/features/stories/server/service'
import { broadcastStory } from '@/features/stories/server/broadcast'

export const runtime = 'nodejs'

const STAFF_ROLES = ['dekan', 'admin', 'tarbiyachi'] as const
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const BUCKET = 'stories'

// A tarbiyachi manages only their own stories; a dekan / admin manages every
// story of their faculty (mirrors app/api/dekan/elonlar/route.ts).
function authorGuard(staff: { role: string; id: string }) {
  return staff.role === 'tarbiyachi' ? staff.id : undefined
}

function errorResponse(error: unknown, fallback: string) {
  console.error('Dekan stories API error:', error)
  const response = getApiError(error, fallback)
  return NextResponse.json(response.body, { status: response.status })
}

export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, STAFF_ROLES)
    const stories = await createStoryService().listAuthored(staff.faculty)
    return NextResponse.json({ stories })
  } catch (error) {
    return errorResponse(error, "Yangiliklarni yuklab bo'lmadi")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, STAFF_ROLES)
    const throttle = await checkRateLimit(`staff-story:${staff.id}`, 20, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }

    const form = await readMultipartForm(request)
    const file = form.get('image')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Rasm tanlanmadi' }, { status: 400 })
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size < 16 || file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: 'Faqat JPEG, PNG yoki WEBP (4 MB gacha) qabul qilinadi' }, { status: 400 })
    }

    const rule = PERMIT_FILE_RULES[file.type]
    const buffer = Buffer.from(await file.arrayBuffer())
    if (!rule || !hasAllowedSignature(buffer, rule.signatures)) {
      return NextResponse.json({ error: 'Rasm formati qo‘llab-quvvatlanmaydi. iPhone rasmi (HEIC) bo‘lsa JPG ga o‘giring.' }, { status: 400 })
    }
    if (file.type === 'image/webp' && buffer.subarray(8, 12).toString('ascii') !== 'WEBP') {
      return NextResponse.json({ error: 'WEBP fayl imzosi noto‘g‘ri' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const path = `${staff.id}/${randomUUID()}.${rule.extension}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      cacheControl: '86400',
      contentType: file.type,
      upsert: false,
    })
    if (uploadError) throw uploadError
    const imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

    let story
    try {
      story = await createStoryService().create(staff.id, staff.full_name, staff.faculty, {
        title: form.get('title'),
        caption: form.get('caption'),
        type: form.get('type'),
        link_url: form.get('link_url'),
        image_url: imageUrl,
        image_path: path,
      })
    } catch (createError) {
      await supabase.storage.from(BUCKET).remove([path])
      throw createError
    }

    // Deliver the image + text to the faculty's students (Telegram + push)
    // after the response is sent — a broadcast failure never blocks publish.
    after(() => broadcastStory(story))

    return NextResponse.json({ story }, { status: 201 })
  } catch (error) {
    return errorResponse(error, "Yangilikni joylab bo'lmadi")
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, STAFF_ROLES)
    const { image_path } = await createStoryService().remove(
      staff.faculty,
      request.nextUrl.searchParams.get('id'),
      authorGuard(staff),
    )
    if (image_path) {
      await getServiceSupabase().storage.from(BUCKET).remove([image_path])
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error, "Yangilikni o'chirib bo'lmadi")
  }
}
