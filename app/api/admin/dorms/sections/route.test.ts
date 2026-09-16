import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  blockedGrid: vi.fn(),
  buildBlockedLayout: vi.fn(),
  assignSection: vi.fn(),
  clearSection: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/features/dorms/server/service', () => ({
  createDormService: () => ({
    blockedGrid: mocks.blockedGrid, buildBlockedLayout: mocks.buildBlockedLayout,
    assignSection: mocks.assignSection, clearSection: mocks.clearSection,
  }),
}))

const { GET, POST } = await import('./route')

function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'admin1', role: 'admin' } })
})

describe('GET /api/admin/dorms/sections', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/admin/dorms/sections?dormId=d1'))
    expect(res.status).toBe(401)
  })

  it('400s a missing dormId', async () => {
    const res = await GET(req('https://example.test/api/admin/dorms/sections'))
    expect(res.status).toBe(400)
    expect(mocks.blockedGrid).not.toHaveBeenCalled()
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.blockedGrid.mockRejectedValue(new Error('db down'))
    const res = await GET(req('https://example.test/api/admin/dorms/sections?dormId=d1'))
    expect(res.status).toBe(500)
  })

  it('returns the blocked grid on success', async () => {
    mocks.blockedGrid.mockResolvedValue({ sections: [] })
    const res = await GET(req('https://example.test/api/admin/dorms/sections?dormId=d1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ grid: { sections: [] } })
  })
})

describe('POST /api/admin/dorms/sections', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await POST(req('https://example.test/api/admin/dorms/sections', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('400s an unrecognised action', async () => {
    const res = await POST(req('https://example.test/api/admin/dorms/sections', {
      method: 'POST', body: JSON.stringify({ action: 'nonsense' }),
    }))
    expect(res.status).toBe(400)
  })

  it('400s buildLayout with a missing dormId', async () => {
    const res = await POST(req('https://example.test/api/admin/dorms/sections', {
      method: 'POST', body: JSON.stringify({ action: 'buildLayout' }),
    }))
    expect(res.status).toBe(400)
    expect(mocks.buildBlockedLayout).not.toHaveBeenCalled()
  })

  it('500s when buildLayout throws unexpectedly', async () => {
    mocks.buildBlockedLayout.mockRejectedValue(new Error('db down'))
    const res = await POST(req('https://example.test/api/admin/dorms/sections', {
      method: 'POST', body: JSON.stringify({ action: 'buildLayout', dormId: 'd1' }),
    }))
    expect(res.status).toBe(500)
  })

  it('builds the blocked layout on success', async () => {
    mocks.buildBlockedLayout.mockResolvedValue({ created: 12 })
    const res = await POST(req('https://example.test/api/admin/dorms/sections', {
      method: 'POST', body: JSON.stringify({ action: 'buildLayout', dormId: 'd1' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, created: 12 })
  })

  it('assigns a section on success, passing the acting staff id', async () => {
    mocks.assignSection.mockResolvedValue({ assigned: true })
    const res = await POST(req('https://example.test/api/admin/dorms/sections', {
      method: 'POST', body: JSON.stringify({ action: 'assignSection', dormId: 'd1', block: 'A', floor: 2, faculty: 'amit' }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.assignSection).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'assignSection', block: 'A', floor: 2 }),
      'admin1',
    )
  })

  it('400s a validation failure from clearSection surfaced by the service', async () => {
    mocks.clearSection.mockRejectedValue(new ApiError(400, 'Seksiya band emas'))
    const res = await POST(req('https://example.test/api/admin/dorms/sections', {
      method: 'POST', body: JSON.stringify({ action: 'clearSection', dormId: 'd1', block: 'A', floor: 2 }),
    }))
    expect(res.status).toBe(400)
  })

  it('clears a section on success', async () => {
    mocks.clearSection.mockResolvedValue({ cleared: true })
    const res = await POST(req('https://example.test/api/admin/dorms/sections', {
      method: 'POST', body: JSON.stringify({ action: 'clearSection', dormId: 'd1', block: 'A', floor: 2 }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, cleared: true })
  })
})
