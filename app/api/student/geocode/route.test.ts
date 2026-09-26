import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  requireActiveStudent: vi.fn(),
  geocodeSearch: vi.fn(),
  geocodeReverse: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStudent: mocks.requireActiveStudent }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/lib/geocode', () => ({ geocodeSearch: mocks.geocodeSearch, geocodeReverse: mocks.geocodeReverse }))

const { GET } = await import('./route')

function req(url: string) {
  return new NextRequest(url)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1' }, user: { id: 's1' } })
  mocks.checkRateLimit.mockResolvedValue({ allowed: true, remaining: 29 })
})

describe('GET /api/student/geocode', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/student/geocode?q=Toshkent'))
    expect(res.status).toBe(401)
  })

  it('500s when the forward search throws unexpectedly', async () => {
    mocks.geocodeSearch.mockRejectedValue(new Error('nominatim down'))
    const res = await GET(req('https://example.test/api/student/geocode?q=Toshkent'))
    expect(res.status).toBe(500)
  })

  it('does a forward search when only q is given', async () => {
    mocks.geocodeSearch.mockResolvedValue([{ name: 'Toshkent' }])
    const res = await GET(req('https://example.test/api/student/geocode?q=Toshkent'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ results: [{ name: 'Toshkent' }] })
    expect(mocks.geocodeReverse).not.toHaveBeenCalled()
  })

  it('does a reverse lookup when lat/lng are given, even alongside q', async () => {
    mocks.geocodeReverse.mockResolvedValue('Chilonzor tumani')
    const res = await GET(req('https://example.test/api/student/geocode?lat=41.3&lng=69.2&q=ignored'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ name: 'Chilonzor tumani' })
    expect(mocks.geocodeReverse).toHaveBeenCalledWith(41.3, 69.2)
    expect(mocks.geocodeSearch).not.toHaveBeenCalled()
  })

  it('500s when the reverse lookup throws unexpectedly', async () => {
    mocks.geocodeReverse.mockRejectedValue(new Error('nominatim down'))
    const res = await GET(req('https://example.test/api/student/geocode?lat=41.3&lng=69.2'))
    expect(res.status).toBe(500)
  })

  it('429s once the per-user search budget is spent', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false, remaining: 0 })
    const res = await GET(req('https://example.test/api/student/geocode?q=Toshkent'))
    expect(res.status).toBe(429)
    expect(mocks.geocodeSearch).not.toHaveBeenCalled()
  })
})
