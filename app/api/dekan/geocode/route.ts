import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { geocodeSearch } from '@/lib/geocode'
import { checkRateLimit } from '@/lib/security'

export const runtime = 'nodejs'

// Server-side proxy to OpenStreetMap's Nominatim geocoder for the dekan's
// yo'qlama location picker. Going through our own origin keeps the CSP
// `connect-src` locked to 'self', lets us send the User-Agent Nominatim's
// usage policy requires, and gates it behind a staff session so it can't be
// used as an open geocoding relay.
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireActiveStaff(request, ['dekan', 'admin'])
    if (!(await checkRateLimit(`geocode:${user.id}`, 30, 60_000)).allowed) {
      return NextResponse.json({ error: "Juda ko'p qidiruv. Birozdan keyin urinib ko'ring." }, { status: 429 })
    }
    const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
    const results = await geocodeSearch(q)
    return NextResponse.json({ results })
  } catch (error) {
    console.error('Dekan geocode error:', error)
    const response = getApiError(error, "Manzilni qidirib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
