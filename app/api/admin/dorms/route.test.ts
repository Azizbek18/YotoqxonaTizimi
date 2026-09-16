import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  listAll: vi.fn(),
  create: vi.fn(),
  reassignFloor: vi.fn(),
  patchSettings: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/features/dorms/server/service', () => ({
  createDormService: () => ({
    listAll: mocks.listAll, create: mocks.create,
    reassignFloor: mocks.reassignFloor, patchSettings: mocks.patchSettings,
  }),
}))

const { GET, POST, PATCH } = await import('./route')

function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'admin1', role: 'admin' } })
})

describe('GET /api/admin/dorms', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/admin/dorms'))
    expect(res.status).toBe(401)
  })

  it('403s a non-superadmin role', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await GET(req('https://example.test/api/admin/dorms'))
    expect(res.status).toBe(403)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.listAll.mockRejectedValue(new Error('db down'))
    const res = await GET(req('https://example.test/api/admin/dorms'))
    expect(res.status).toBe(500)
  })

  it('returns every dorm on success', async () => {
    mocks.listAll.mockResolvedValue([{ id: 'd1' }])
    const res = await GET(req('https://example.test/api/admin/dorms'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ dorms: [{ id: 'd1' }] })
  })
})

describe('POST /api/admin/dorms', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await POST(req('https://example.test/api/admin/dorms', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('400s a validation failure surfaced by the service', async () => {
    mocks.create.mockRejectedValue(new ApiError(400, 'Nomi kerak'))
    const res = await POST(req('https://example.test/api/admin/dorms', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.create.mockRejectedValue(new Error('db down'))
    const res = await POST(req('https://example.test/api/admin/dorms', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(500)
  })

  it('creates the dorm on success', async () => {
    mocks.create.mockResolvedValue(undefined)
    const res = await POST(req('https://example.test/api/admin/dorms', {
      method: 'POST', body: JSON.stringify({ number: 7, name: 'Yangi TTJ' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

describe('PATCH /api/admin/dorms', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await PATCH(req('https://example.test/api/admin/dorms', { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('400s a missing dormId', async () => {
    const res = await PATCH(req('https://example.test/api/admin/dorms', { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(400)
    expect(mocks.patchSettings).not.toHaveBeenCalled()
  })

  it('400s an unparsable JSON body', async () => {
    const res = await PATCH(new NextRequest('https://example.test/api/admin/dorms', {
      method: 'PATCH', body: 'not json', headers: { 'content-type': 'application/json' },
    }))
    expect(res.status).toBe(400)
  })

  it('500s when reassignFloor throws unexpectedly', async () => {
    mocks.reassignFloor.mockRejectedValue(new Error('db down'))
    const res = await PATCH(req('https://example.test/api/admin/dorms', {
      method: 'PATCH', body: JSON.stringify({ dormId: 'd1', action: 'reassignFloor', floor: 3, faculty: 'amit' }),
    }))
    expect(res.status).toBe(500)
  })

  it('reassigns a floor on the reassignFloor action', async () => {
    mocks.reassignFloor.mockResolvedValue(undefined)
    const res = await PATCH(req('https://example.test/api/admin/dorms', {
      method: 'PATCH', body: JSON.stringify({ dormId: 'd1', action: 'reassignFloor', floor: 3, faculty: 'amit' }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.reassignFloor).toHaveBeenCalledWith('d1', 3, 'amit')
    expect(mocks.patchSettings).not.toHaveBeenCalled()
  })

  it('patches settings on success (default action)', async () => {
    mocks.patchSettings.mockResolvedValue(undefined)
    const res = await PATCH(req('https://example.test/api/admin/dorms', {
      method: 'PATCH', body: JSON.stringify({ dormId: 'd1', settings: { ttjName: '7' } }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.patchSettings).toHaveBeenCalledWith('d1', { ttjName: '7' })
  })
})
