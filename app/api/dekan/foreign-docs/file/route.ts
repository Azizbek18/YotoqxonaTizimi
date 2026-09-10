import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { getServiceSupabase } from '@/lib/server-supabase'
import { createForeignDocsService } from '@/features/foreign-docs/server/service'

const BUCKET = 'permits'

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireActiveStaff(request, ['dekan', 'admin'])
    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Noto'g'ri identifikator" }, { status: 400 })
    }
    const { filePath } = await createForeignDocsService().getForFileAccess(id, {
      userId: user.id,
      isStaff: true,
    })
    const supabase = getServiceSupabase()
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60, filePath.toLowerCase().endsWith('.pdf') ? { download: true } : undefined)
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Havolani yaratib bo‘lmadi' }, { status: 500 })
    }
    return NextResponse.json({ url: data.signedUrl })
  } catch (error) {
    console.error('Dekan foreign-doc file URL error:', error)
    const r = getApiError(error, 'Faylni ochib bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
