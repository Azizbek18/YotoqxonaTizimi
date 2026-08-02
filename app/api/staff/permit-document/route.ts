import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

export async function GET(request: NextRequest) {
  try {
    // Permit hujjatlari dekan ish oqimiga tegishli. Tarbiyachi o'z
    // qavati talabalarini boshqarsa ham, barcha fakultetlarning qabul
    // yo'llanmalarini ko'rish vakolatiga ega emas.
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan'])

    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Noto‘g‘ri ariza identifikatori.' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const { data: permit, error: permitError } = await supabase
      .from('permit_requests')
      .select('permit_url, faculty')
      .eq('id', id)
      .maybeSingle()
    if (permitError) throw permitError
    if (!permit) return NextResponse.json({ error: 'Yo‘llanma topilmadi.' }, { status: 404 })

    if (
      staff.role === 'dekan'
      && (!staff.faculty || staff.faculty.trim().toLocaleLowerCase() !== permit.faculty.trim().toLocaleLowerCase())
    ) {
      return NextResponse.json({ error: 'Ruxsat berilmadi.' }, { status: 403 })
    }

    // Legacy rows may contain a public URL. New rows store only a private path.
    if (/^https:\/\//i.test(permit.permit_url)) {
      return NextResponse.json({ url: permit.permit_url })
    }
    const { data, error } = await supabase.storage
      .from('permits')
      .createSignedUrl(
        permit.permit_url,
        60,
        permit.permit_url.toLowerCase().endsWith('.pdf') ? { download: true } : undefined,
      )
    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Hujjat havolasini yaratib bo‘lmadi.' }, { status: 500 })
    }
    return NextResponse.json({ url: data.signedUrl })
  } catch (error) {
    const response = getApiError(error, 'Hujjat havolasini yaratib bo‘lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}
