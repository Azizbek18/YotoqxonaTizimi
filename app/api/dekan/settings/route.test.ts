import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  requirePickedFaculty: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/server/auth/faculty', () => ({ requirePickedFaculty: mocks.requirePickedFaculty }))
vi.mock('@/features/app-settings/server/service', () => ({
  createAppSettingsService: () => ({ get: mocks.get, update: mocks.update }),
}))

const { GET, PUT } = await import('./route')

function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'staff1', faculty: 'amit' } })
  mocks.requirePickedFaculty.mockReturnValue('amit')
})

describe('GET /api/dekan/settings', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/dekan/settings'))
    expect(res.status).toBe(401)
  })

  it('403s a role outside dekan/admin/tarbiyachi', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await GET(req('https://example.test/api/dekan/settings'))
    expect(res.status).toBe(403)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.get.mockRejectedValue(new Error('db down'))
    const res = await GET(req('https://example.test/api/dekan/settings'))
    expect(res.status).toBe(500)
  })

  it('returns the faculty settings on success', async () => {
    mocks.get.mockResolvedValue({ monthlyFee: 300000 })
    const res = await GET(req('https://example.test/api/dekan/settings?dormId=d1'))
    expect(res.status).toBe(200)
    expect(mocks.get).toHaveBeenCalledWith('amit', 'd1')
  })
})

describe('PUT /api/dekan/settings', () => {
  it('403s a tarbiyachi (read-only, cannot edit settings)', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await PUT(req('https://example.test/api/dekan/settings', { method: 'PUT', body: '{}' }))
    expect(res.status).toBe(403)
  })

  it('400s a validation failure surfaced by the service', async () => {
    mocks.update.mockRejectedValue(new ApiError(400, 'Summani noto‘g‘ri'))
    const res = await PUT(req('https://example.test/api/dekan/settings', {
      method: 'PUT', body: JSON.stringify({ monthlyFee: -1 }),
    }))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.update.mockRejectedValue(new Error('db down'))
    const res = await PUT(req('https://example.test/api/dekan/settings', { method: 'PUT', body: '{}' }))
    expect(res.status).toBe(500)
  })

  it('updates the faculty settings on success', async () => {
    mocks.update.mockResolvedValue({ ok: true })
    const res = await PUT(req('https://example.test/api/dekan/settings', {
      method: 'PUT', body: JSON.stringify({ monthlyFee: 350000, dormId: 'd1' }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith({ monthlyFee: 350000, dormId: 'd1' }, 'amit', 'd1')
  })
})
