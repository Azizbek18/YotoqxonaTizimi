import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getRequestUser: vi.fn(),
  listForUser: vi.fn(),
}))

vi.mock('@/lib/server-auth', () => ({ getRequestUser: mocks.getRequestUser }))
vi.mock('@/features/announcements/server/service', () => ({
  createAnnouncementService: () => ({ listForUser: mocks.listForUser }),
}))

const { GET } = await import('./route')

beforeEach(() => {
  vi.resetAllMocks()
  mocks.listForUser.mockResolvedValue({ elonlar: [] })
})

describe('GET /api/elonlar', () => {
  it('401s a signed-out caller instead of serving the primary faculty notices', async () => {
    mocks.getRequestUser.mockResolvedValue(null)
    const res = await GET(new NextRequest('https://example.test/api/elonlar'))
    expect(res.status).toBe(401)
    expect(mocks.listForUser).not.toHaveBeenCalled()
  })

  it('lists notices for the signed-in user', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
    const res = await GET(new NextRequest('https://example.test/api/elonlar'))
    expect(res.status).toBe(200)
    expect(mocks.listForUser).toHaveBeenCalledWith('u1')
  })
})
