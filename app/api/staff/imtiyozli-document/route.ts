import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { requireActiveStaff } from '@/server/auth/guards'
import { permitFacultyLabel } from '@/lib/faculties'
import { getApiError } from '@/server/http/api-error'

// Renders the same Ariza+Tilxat text the applicant filled in — dekan
// reviews the document content itself, not just a raw file link, since
// 'imtiyozli' applications have no uploaded document beyond a passport
// photo (see /api/staff/permit-document for that).
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan'])

    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Noto‘g‘ri ariza identifikatori.' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const [{ data: permit, error }, { data: settings }] = await Promise.all([
      supabase
        .from('permit_requests')
        .select('full_name, faculty, course, study_type, origin_country, origin_region, phone, relative_phone, application_type')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('app_settings').select('ttj_name').eq('id', 1).maybeSingle(),
    ])
    if (error) throw error
    if (!permit) return NextResponse.json({ error: 'Ariza topilmadi.' }, { status: 404 })
    if (permit.application_type !== 'imtiyozli') {
      return NextResponse.json({ error: 'Bu ariza uchun Tilxat/Ariza hujjati mavjud emas.' }, { status: 400 })
    }

    if (
      staff.role === 'dekan'
      && (!staff.faculty || staff.faculty.trim().toLocaleLowerCase() !== permit.faculty.trim().toLocaleLowerCase())
    ) {
      return NextResponse.json({ error: 'Ruxsat berilmadi.' }, { status: 403 })
    }

    return NextResponse.json({
      data: {
        fullName: permit.full_name,
        facultyLabel: permitFacultyLabel(permit.faculty),
        course: permit.course,
        studyType: permit.study_type ?? '',
        originCountry: permit.origin_country ?? '',
        originRegion: permit.origin_region ?? '',
        phone: (permit.phone ?? '').replace(/^\+998/, '').trim(),
        relativePhone: permit.relative_phone ?? '',
        ttjName: settings?.ttj_name ?? '',
      },
    })
  } catch (error) {
    const response = getApiError(error, 'Hujjat ma’lumotlarini yuklab bo‘lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}
