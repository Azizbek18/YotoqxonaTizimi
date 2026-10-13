import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { createCertificatesService } from '@/features/certificates/server/service'

// Tasdiqlangan ma'lumotnoma ma'lumotlari (PDF brauzerda yig'iladi).
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { student } = await requireActiveStudent(request, { allowBlacklisted: true })
    const { id } = await context.params
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Noto'g'ri identifikator" }, { status: 400 })
    }
    const certificate = await createCertificatesService().documentForStudent(student.id, id)
    return NextResponse.json({ certificate })
  } catch (error) {
    console.error('Certificate GET error:', error)
    const r = getApiError(error, "Ma'lumotnomani yuklab bo'lmadi")
    return NextResponse.json(r.body, { status: r.status })
  }
}
