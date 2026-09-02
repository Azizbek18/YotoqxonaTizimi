import { NextRequest, NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/server-supabase'
import { requireActiveStaff } from '@/server/auth/guards'
import { normalizeFaculty, permitFacultyLabel } from '@/lib/faculties'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { getApiError } from '@/server/http/api-error'

// Renders the same Ariza+Tilxat text the applicant filled in and downloaded
// to sign — both 'imtiyozli' and 'yollanma' applicants produce one now, so
// the dekan can check the signed paper against what the system generated.
export async function GET(request: NextRequest) {
  try {
    const { staff } = await requireActiveStaff(request, ['admin', 'dekan'])

    const id = request.nextUrl.searchParams.get('id')
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      return NextResponse.json({ error: 'Noto‘g‘ri ariza identifikatori.' }, { status: 400 })
    }

    const supabase = getServiceSupabase()
    const { data: permit, error } = await supabase
      .from('permit_requests')
      .select('full_name, faculty, course, study_type, origin_country, origin_region, phone, relative_phone, application_type')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    if (!permit) return NextResponse.json({ error: 'Ariza topilmadi.' }, { status: 404 })
    // Older yo'llanma rows (submitted before the Ariza/Tilxat step existed)
    // have no study_type/origin data — nothing to render for those.
    if (permit.application_type === 'yollanma' && !permit.study_type && !permit.origin_region) {
      return NextResponse.json({ error: 'Bu ariza uchun Ariza/Tilxat hujjati mavjud emas.' }, { status: 400 })
    }

    if (
      staff.role === 'dekan'
      && (!staff.faculty || staff.faculty.trim().toLocaleLowerCase() !== permit.faculty.trim().toLocaleLowerCase())
    ) {
      return NextResponse.json({ error: 'Ruxsat berilmadi.' }, { status: 403 })
    }

    // The dorm building number is the permit faculty's own setting.
    const settings = await createAppSettingsService().get(normalizeFaculty(permit.faculty) ?? undefined)

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
        ttjName: settings.ttjName,
      },
    })
  } catch (error) {
    const response = getApiError(error, 'Hujjat ma’lumotlarini yuklab bo‘lmadi')
    return NextResponse.json(response.body, { status: response.status })
  }
}
