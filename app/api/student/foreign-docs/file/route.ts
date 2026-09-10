import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/server-auth'
import { getServiceSupabase } from '@/lib/server-supabase'
import { getApiError } from '@/server/http/api-error'
import { createForeignDocsService } from '@/features/foreign-docs/server/service'

const BUCKET = 'permits'

// Xorijiy talaba hujjati fayli xususiy `permits` bucketda — faqat egasi yoki
// faol dekan/superadmin qisqa muddatli signed URL orqali ochadi.
export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request)
    if (!user?.id) {
      return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi' }, { status: 401 })
    }
    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: "Noto'g'ri identifikator" }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const { data: staff } = await supabase
      .from('staff')
      .select('role, status')
      .eq('id', user.id)
      .maybeSingle()
    const isStaff = staff?.status === 'active' && (staff.role === 'dekan' || staff.role === 'admin')

    const { filePath } = await createForeignDocsService().getForFileAccess(id, {
      userId: user.id,
      isStaff: Boolean(isStaff),
    })

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(filePath, 60, filePath.toLowerCase().endsWith('.pdf') ? { download: true } : undefined)
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Havolani yaratib bo‘lmadi' }, { status: 500 })
    }
    return NextResponse.json({ url: data.signedUrl })
  } catch (error) {
    console.error('Foreign-doc file URL error:', error)
    const r = getApiError(error, 'Faylni ochib bo‘lmadi')
    return NextResponse.json(r.body, { status: r.status })
  }
}
