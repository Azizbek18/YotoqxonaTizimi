import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit } from '@/lib/security'
import { readMultipartForm, MAX_UPLOAD_SIZE_BYTES } from '@/lib/upload-limits'
import { PERMIT_FILE_RULES, detectPermitFileMimeType } from '@/lib/permit-validation'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { createForeignDocsService } from '@/features/foreign-docs/server/service'
import type { ForeignDocInput } from '@/features/foreign-docs/types'

const BUCKET = 'permits'
const folderFor = (studentId: string, docId: string) => `foreign-docs/${studentId}/${docId}`

export async function GET(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request, { allowBlacklisted: true })
    const docs = await createForeignDocsService().listForStudent(student.id)
    return NextResponse.json({ docs })
  } catch (error) {
    console.error('Foreign-docs GET error:', error)
    const r = getApiError(error, "Hujjatlarni yuklab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const throttle = await checkRateLimit(`foreign-doc-save:${student.id}`, 20, 5 * 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }

    const form = await readMultipartForm(request)
    const rawPayload = form.get('payload')
    if (typeof rawPayload !== 'string') {
      return NextResponse.json({ error: "So'rov noto'g'ri" }, { status: 400 })
    }
    let input: ForeignDocInput
    try {
      input = JSON.parse(rawPayload) as ForeignDocInput
    } catch {
      return NextResponse.json({ error: "So'rov formati noto'g'ri" }, { status: 400 })
    }

    const service = createForeignDocsService()
    const doc = await service.saveForStudent(student.id, input)

    const file = form.get('file')
    if (file instanceof File && file.size > 0) {
      const { maxUploadSizeMb } = await createAppSettingsService().get()
      const limit = Math.min(maxUploadSizeMb * 1024 * 1024, MAX_UPLOAD_SIZE_BYTES)
      if (file.size < 16 || file.size > limit) {
        return NextResponse.json(
          { error: `Fayl hajmi ${maxUploadSizeMb} MB dan oshmasligi kerak`, doc },
          { status: 400 },
        )
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const mime = detectPermitFileMimeType(buffer)
      if (!mime) {
        return NextResponse.json(
          { error: 'Faqat JPG, PNG, WEBP yoki PDF qabul qilinadi', doc },
          { status: 400 },
        )
      }
      const supabase = getServiceSupabase()
      const folder = folderFor(student.id, doc.id)
      const path = `${folder}/${randomUUID()}.${PERMIT_FILE_RULES[mime].extension}`
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: mime, upsert: false })
      if (uploadError) throw uploadError

      // Eski faylni tozalash — bir hujjatga bitta fayl.
      const { data: existing } = await supabase.storage.from(BUCKET).list(folder)
      const stale = (existing ?? [])
        .filter((entry) => `${folder}/${entry.name}` !== path)
        .map((entry) => `${folder}/${entry.name}`)
      if (stale.length) await supabase.storage.from(BUCKET).remove(stale)

      await service.attachFile(doc.id, path, { studentId: student.id })
      doc.hasFile = true
    }

    return NextResponse.json({ doc })
  } catch (error) {
    console.error('Foreign-docs POST error:', error)
    const r = getApiError(error, "Hujjatni saqlab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { student } = await requireActiveStudent(request)
    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Noto'g'ri identifikator" }, { status: 400 })
    }
    await createForeignDocsService().deleteForStudent(id, student.id)
    // Fayl(lar)ni ham tozalash — best-effort.
    try {
      const supabase = getServiceSupabase()
      const folder = folderFor(student.id, id)
      const { data: existing } = await supabase.storage.from(BUCKET).list(folder)
      if (existing?.length) {
        await supabase.storage.from(BUCKET).remove(existing.map((e) => `${folder}/${e.name}`))
      }
    } catch (cleanupError) {
      console.error('Foreign-doc file cleanup failed:', cleanupError)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Foreign-docs DELETE error:', error)
    const r = getApiError(error, "Hujjatni o'chirib bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
