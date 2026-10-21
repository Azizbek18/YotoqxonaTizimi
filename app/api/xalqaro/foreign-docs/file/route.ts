import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { getServiceSupabase } from '@/lib/server-supabase'
import { checkRateLimit, getClientIp } from '@/lib/security'
import { writeAuditLog } from '@/lib/audit-log'
import { createForeignDocsService } from '@/features/foreign-docs/server/service'

const BUCKET = 'permits'

// International office: open the scan of a foreign student's VISA or
// registration (propiska) from any faculty. Passport-grade data, so every open
// is rate-limited and written to the security audit log; the link itself is a
// 60-second signed URL. Lease contracts and non-foreign students' files are
// refused by the service.
export async function GET(request: NextRequest) {
  try {
    const { user, staff } = await requireActiveStaff(request, ['xalqaro', 'admin'])
    const throttle = await checkRateLimit(`xalqaro-doc-file:${staff.id}`, 60, 60_000)
    if (!throttle.allowed) {
      return NextResponse.json({ error: "Juda ko'p urinish. Keyinroq urinib ko'ring." }, { status: 429 })
    }
    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Noto'g'ri identifikator" }, { status: 400 })
    }

    const { filePath, studentId } = await createForeignDocsService().getForInternationalFileAccess(id)
    const { data, error } = await getServiceSupabase()
      .storage.from(BUCKET)
      .createSignedUrl(filePath, 60, filePath.toLowerCase().endsWith('.pdf') ? { download: true } : undefined)
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Havolani yaratib bo‘lmadi' }, { status: 500 })
    }

    await writeAuditLog({
      eventType: 'xalqaro.foreign_doc_file_opened',
      status: 'success',
      ipAddress: getClientIp(request),
      actorUserId: user.id,
      targetRole: 'talaba',
      details: { documentId: id, studentId, staffRole: staff.role },
    })
    return NextResponse.json({ url: data.signedUrl })
  } catch (error) {
    console.error('Xalqaro foreign-doc file URL error:', error)
    const r = getApiError(error, 'Faylni ochib bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
