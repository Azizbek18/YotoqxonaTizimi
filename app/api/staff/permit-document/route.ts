import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/server-auth'
import { getServiceSupabase } from '@/lib/server-supabase'

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request)
  if (!user) return NextResponse.json({ error: 'Autentifikatsiya talab qilinadi.' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Noto‘g‘ri ariza identifikatori.' }, { status: 400 })
  }

  const supabase = getServiceSupabase()
  const [{ data: staff }, { data: permit }] = await Promise.all([
    supabase.from('staff').select('role, faculty, status').eq('id', user.id).maybeSingle(),
    supabase.from('permit_requests').select('permit_url, faculty').eq('id', id).maybeSingle(),
  ])
  if (!staff || staff.status !== 'active' || !permit) {
    return NextResponse.json({ error: 'Ruxsat berilmadi.' }, { status: 403 })
  }
  const allowed = staff.role === 'admin' || staff.role === 'tarbiyachi' || (
    staff.role === 'zamdekan' && staff.faculty && staff.faculty.toLowerCase() === permit.faculty.toLowerCase()
  )
  if (!allowed) return NextResponse.json({ error: 'Ruxsat berilmadi.' }, { status: 403 })

  // Legacy rows may contain a public URL. New rows store only a private path.
  if (/^https:\/\//i.test(permit.permit_url)) {
    return NextResponse.json({ url: permit.permit_url })
  }
  const { data, error } = await supabase.storage.from('permits').createSignedUrl(permit.permit_url, 60)
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'Hujjat havolasini yaratib bo‘lmadi.' }, { status: 500 })
  }
  return NextResponse.json({ url: data.signedUrl })
}
