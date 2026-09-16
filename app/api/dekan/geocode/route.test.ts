import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  geocodeSearch: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/lib/geocode', () => ({ geocodeSearch: mocks.geocodeSearch }))

const { GET } = await import('./route')

function req(url: string) {
  return new NextRequest(url)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'staff1', role: 'dekan' } })
})

describe('GET /api/dekan/geocode', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/dekan/geocode?q=Toshkent'))
    expect(res.status).toBe(401)
  })

  it('403s a role outside dekan/admin', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await GET(req('https://example.test/api/dekan/geocode?q=Toshkent'))
    expect(res.status).toBe(403)
  })

  it('500s when the geocoder throws unexpectedly', async () => {
    mocks.geocodeSearch.mockRejectedValue(new Error('nominatim down'))
    const res = await GET(req('https://example.test/api/dekan/geocode?q=Toshkent'))
    expect(res.status).toBe(500)
  })

  it('searches with an empty query when q is missing', async () => {
    mocks.geocodeSearch.mockResolvedValue([])
    await GET(req('https://example.test/api/dekan/geocode'))
    expect(mocks.geocodeSearch).toHaveBeenCalledWith('')
  })

  it('returns search results on success', async () => {
    mocks.geocodeSearch.mockResolvedValue([{ name: 'Toshkent', lat: 41.3, lng: 69.2 }])
    const res = await GET(req('https://example.test/api/dekan/geocode?q=Toshkent'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ results: [{ name: 'Toshkent', lat: 41.3, lng: 69.2 }] })
  })
})
