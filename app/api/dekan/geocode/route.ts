import { NextRequest, NextResponse } from 'next/server'
import { requireActiveStaff } from '@/server/auth/guards'
import { getApiError } from '@/server/http/api-error'

export const runtime = 'nodejs'

type NominatimRow = {
  display_name?: string
  lat?: string
  lon?: string
}

// Server-side proxy to OpenStreetMap's Nominatim geocoder for the dekan's
// yo'qlama location picker. Going through our own origin keeps the CSP
// `connect-src` locked to 'self', lets us send the User-Agent Nominatim's
// usage policy requires, and gates it behind a staff session so it can't be
// used as an open geocoding relay.
export async function GET(request: NextRequest) {
  try {
    await requireActiveStaff(request, ['dekan', 'admin'])

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (q.length < 3) return NextResponse.json({ results: [] })

    const url = new URL('https://nominatim.openstreetmap.org/search')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('q', q)
    url.searchParams.set('limit', '6')
    url.searchParams.set('accept-language', 'uz,ru,en')
    // Bias toward Uzbekistan without hard-excluding a cross-border search.
    url.searchParams.set('countrycodes', 'uz')

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'meningyotoqxonam.uz (dorm attendance location picker)',
        'Accept': 'application/json',
      },
      // Nominatim results for a given query are stable — let the platform
      // cache identical lookups for a day.
      next: { revalidate: 86400 },
    })
    if (!res.ok) return NextResponse.json({ results: [] })

    const rows = (await res.json()) as NominatimRow[]
    const results = (Array.isArray(rows) ? rows : [])
      .map((r) => ({
        name: String(r.display_name ?? '').trim(),
        lat: Number(r.lat),
        lng: Number(r.lon),
      }))
      .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng))

    return NextResponse.json({ results })
  } catch (error) {
    console.error('Dekan geocode error:', error)
    const response = getApiError(error, "Manzilni qidirib bo'lmadi")
    return NextResponse.json(response.body, { status: response.status })
  }
}
