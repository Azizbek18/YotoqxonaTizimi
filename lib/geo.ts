// Great-circle distance between two lat/lng points, in metres. Used by the
// attendance check-in to compare a student's phone location against the
// stored dorm coordinate.

const EARTH_RADIUS_M = 6_371_000

const toRad = (deg: number) => (deg * Math.PI) / 180

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h))))
}

/** A finite number in the valid WGS-84 range, else null. */
export function asCoordinate(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (lat == null || lng == null || lat === '' || lng === '') return null
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null
  return { lat: la, lng: ln }
}
