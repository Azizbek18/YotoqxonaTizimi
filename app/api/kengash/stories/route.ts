import { randomUUID } from 'crypto'
import { NextRequest, NextResponse, after } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { PERMIT_FILE_RULES, hasAllowedSignature } from '@/lib/permit-validation'
import { readMultipartForm, MAX_UPLOAD_SIZE_BYTES } from '@/lib/upload-limits'
import { checkRateLimit } from '@/lib/security'
import { requireCouncilChair } from '@/server/auth/council'
import { getApiError } from '@/server/http/api-error'
import { createStoryService } from '@/features/stories/server/service'
import { broadcastStory } from '@/features/stories/server/broadcast'

export const runtime = 'nodejs'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const BUCKET = 'stories'

function errorResponse(error: unknown, fallback: string) {
  console.error('Kengash stories API error:', error)
  const response = getApiError(error, fallback)
  return NextResponse.json(response.body, { status: response.status })
}

// A raisi manages only the stories they themselves posted — unlike a dekan,
// they don't own the whole faculty's announcement channel.
export async function GET(request: NextRequest) {
  try {
    const scoped = await requireCouncilChair(request)
    if (scoped.error) return scoped.error
    const { caller, faculty } = scoped

    const stories = await createStoryService().listAuthored(faculty, caller.id)
    return NextResponse.json({ stories })
  } catch (error) {
    return errorResponse(error, "Yangiliklarni yuklab bo'lmadi")
  }
}

export async function POST(request: NextRequest) {
  try {
    const scoped = await requireCouncilChair(request, 'council.announcements')
    if (scoped.error) return scoped.error
    const { caller, faculty } = scoped

    const throttle = await checkRateLimit(`raisi-story:${caller.id}`, 20, 60_000)
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
    const path = `${caller.id}/${randomUUID()}.${rule.extension}`
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      cacheControl: '86400',
      contentType: file.type,
      upsert: false,
    })
    if (uploadError) throw uploadError
    const imageUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl

    let story
    try {
      story = await createStoryService().create(
        caller.id,
        caller.full_name,
        faculty,
        {
          title: form.get('title'),
          caption: form.get('caption'),
          type: form.get('type'),
          link_url: form.get('link_url'),
          image_url: imageUrl,
          image_path: path,
        },
        null,
      )
    } catch (createError) {
      await supabase.storage.from(BUCKET).remove([path])
      throw createError
    }

    // Deliver to the whole faculty, both genders — after() so a broadcast
    // failure never blocks the publish response.
    after(() => broadcastStory(story))

    return NextResponse.json({ story }, { status: 201 })
  } catch (error) {
    return errorResponse(error, "Yangilikni joylab bo'lmadi")
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const scoped = await requireCouncilChair(request, 'council.announcements')
    if (scoped.error) return scoped.error
    const { caller, faculty } = scoped

    const { image_path } = await createStoryService().remove(
      faculty,
      request.nextUrl.searchParams.get('id'),
      caller.id,
    )
    if (image_path) {
      await getServiceSupabase().storage.from(BUCKET).remove([image_path])
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return errorResponse(error, "Yangilikni o'chirib bo'lmadi")
  }
}
