import { NextRequest, NextResponse } from 'next/server'
import { createAppSettingsService } from '@/features/app-settings/server/service'
import { normalizeFaculty } from '@/lib/faculties'

// Deliberately unauthenticated: the imtiyozli-ariza applicant fills out
// their Ariza/Tilxat preview before ever logging in, and needs to see the
// same "___-sonli talabalar turar joyi" value the dekan configured for the
// faculty they picked — not a blank that then gets silently replaced
// server-side. Nothing else from app_settings is exposed here (staff phone
// numbers etc. stay behind the authenticated /api/settings).
export async function GET(request: NextRequest) {
  try {
    const faculty = normalizeFaculty(request.nextUrl.searchParams.get('faculty')) ?? undefined
    const settings = await createAppSettingsService().get(faculty)
    return NextResponse.json({ ttjName: settings.ttjName })
  } catch (error) {
    console.error('Public TTJ name fetch failed:', error)
    return NextResponse.json({ ttjName: '' })
  }
}
