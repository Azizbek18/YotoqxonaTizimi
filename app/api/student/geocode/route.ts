import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStudent } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'
import { geocodeSearch, geocodeReverse } from '@/lib/geocode'

export const runtime = 'nodejs'

// Student-facing twin of /api/dekan/geocode — powers the propiska address
// map picker (features/foreign-docs). Two modes on one GET:
//   ?q=<query>       forward search, same shape as the dekan route
//   ?lat=&lng=       reverse lookup — the name Nominatim resolves the pin's
//                    coordinates to, auto-filling the address field below
//                    the map once a place is picked/dragged/clicked.
export async function GET(request: NextRequest) {
  try {
    await requireActiveStudent(request)

    const lat = request.nextUrl.searchParams.get('lat')
    const lng = request.nextUrl.searchParams.get('lng')
    if (lat !== null && lng !== null) {
      const name = await geocodeReverse(Number(lat), Number(lng))
      return NextResponse.json({ name })
    }

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
    const results = await geocodeSearch(q)
    return NextResponse.json({ results })
  } catch (error) {
    console.error('Student geocode error:', error)
    const response = getApiError(error, "Manzilni qidirib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
