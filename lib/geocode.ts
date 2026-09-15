import 'server-only'

// Shared OpenStreetMap Nominatim wrapper — forward search (place name →
// coordinates) and reverse lookup (coordinates → place name). Used by the
// dekan's yo'qlama location picker AND the student's propiska address
// picker (features/foreign-docs). Kept here instead of duplicated per-route
// so both call sites send the same User-Agent Nominatim's usage policy
// requires and get the same caching/shape.

export type GeocodeResult = { name: string; lat: number; lng: number }

type NominatimSearchRow = {
  display_name?: string
  lat?: string
  lon?: string
}

type NominatimReverseRow = {
  display_name?: string
  lat?: string
  lon?: string
  error?: string
}

const USER_AGENT = 'meningyotoqxonam.uz (dorm/address location picker)'

export async function geocodeSearch(query: string): Promise<GeocodeResult[]> {
  const q = query.trim()
  if (q.length < 3) return []

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '6')
  url.searchParams.set('accept-language', 'uz,ru,en')
  // Bias toward Uzbekistan without hard-excluding a cross-border search.
  url.searchParams.set('countrycodes', 'uz')

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    // Nominatim results for a given query are stable — let the platform
    // cache identical lookups for a day.
    next: { revalidate: 86400 },
  })
  if (!res.ok) return []

  const rows = (await res.json()) as NominatimSearchRow[]
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      name: String(r.display_name ?? '').trim(),
      lat: Number(r.lat),
      lng: Number(r.lon),
    }))
    .filter((r) => r.name && Number.isFinite(r.lat) && Number.isFinite(r.lng))
}

/** Coordinates → the place name Nominatim resolves them to, or null. */
export async function geocodeReverse(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('accept-language', 'uz,ru,en')
  url.searchParams.set('zoom', '18')

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
    next: { revalidate: 86400 },
  })
  if (!res.ok) return null

  const row = (await res.json()) as NominatimReverseRow
  const name = String(row?.display_name ?? '').trim()
  return name || null
}
