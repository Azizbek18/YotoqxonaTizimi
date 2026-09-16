import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  requirePickedFaculty: vi.fn(),
  preview: vi.fn(),
  getDekanDorm: vi.fn(),
  listDekanDorms: vi.fn(),
  setUp: vi.fn(),
  resolve: vi.fn(),
  withdraw: vi.fn(),
  patchOwnDorm: vi.fn(),
  setPrimary: vi.fn(),
  unlinkDorm: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/server/auth/faculty', () => ({ requirePickedFaculty: mocks.requirePickedFaculty }))
vi.mock('@/features/dorms/server/service', () => ({
  createDormService: () => ({
    preview: mocks.preview, getDekanDorm: mocks.getDekanDorm, listDekanDorms: mocks.listDekanDorms,
    setUp: mocks.setUp, resolve: mocks.resolve, withdraw: mocks.withdraw,
    patchOwnDorm: mocks.patchOwnDorm, setPrimary: mocks.setPrimary, unlinkDorm: mocks.unlinkDorm,
  }),
}))

const { GET, POST, PATCH } = await import('./route')

function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'staff1', faculty: 'amit' } })
  mocks.requirePickedFaculty.mockReturnValue('amit')
})

describe('GET /api/dekan/dorm', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/dekan/dorm'))
    expect(res.status).toBe(401)
  })

  it('400s a superadmin with no faculty picked', async () => {
    mocks.requirePickedFaculty.mockImplementation(() => {
      throw new ApiError(400, 'Avval fakultetni tanlang', 'SCOPE_REQUIRED')
    })
    const res = await GET(req('https://example.test/api/dekan/dorm'))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.getDekanDorm.mockRejectedValue(new Error('db down'))
    mocks.listDekanDorms.mockResolvedValue([])
    const res = await GET(req('https://example.test/api/dekan/dorm'))
    expect(res.status).toBe(500)
  })

  it('returns a preview when ?number= is given', async () => {
    mocks.preview.mockResolvedValue({ number: 7 })
    const res = await GET(req('https://example.test/api/dekan/dorm?number=7'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ preview: { number: 7 } })
    expect(mocks.getDekanDorm).not.toHaveBeenCalled()
  })

  it('returns the dorm + dorms list on a plain request', async () => {
    mocks.getDekanDorm.mockResolvedValue({ id: 'd1' })
    mocks.listDekanDorms.mockResolvedValue([{ id: 'd1' }])
    const res = await GET(req('https://example.test/api/dekan/dorm'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ dorm: { id: 'd1' }, dorms: [{ id: 'd1' }] })
  })
})

describe('POST /api/dekan/dorm (setUp)', () => {
  it('403s a tarbiyachi (read-only role, cannot set up the dorm)', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await POST(req('https://example.test/api/dekan/dorm', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(403)
  })

  it('400s a validation failure surfaced by the service', async () => {
    mocks.setUp.mockRejectedValue(new ApiError(400, 'Nomi kerak'))
    const res = await POST(req('https://example.test/api/dekan/dorm', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('sets up the dorm on success', async () => {
    mocks.setUp.mockResolvedValue({ ok: true })
    const res = await POST(req('https://example.test/api/dekan/dorm', {
      method: 'POST', body: JSON.stringify({ number: 7, floors: 9 }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})

describe('PATCH /api/dekan/dorm', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await PATCH(req('https://example.test/api/dekan/dorm', { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('400s an unrecognised action', async () => {
    const res = await PATCH(req('https://example.test/api/dekan/dorm', {
      method: 'PATCH', body: JSON.stringify({ action: 'nonsense' }),
    }))
    expect(res.status).toBe(400)
  })

  it('resolves a floor claim on the "resolve" action', async () => {
    mocks.resolve.mockResolvedValue({ ok: true })
    const res = await PATCH(req('https://example.test/api/dekan/dorm', {
      method: 'PATCH', body: JSON.stringify({ action: 'resolve', floor: 3, accept: true }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.resolve).toHaveBeenCalledWith(expect.anything(), 3, true, undefined)
  })

  it('withdraws floors on the "withdraw" action', async () => {
    mocks.withdraw.mockResolvedValue({ id: 'd1' })
    const res = await PATCH(req('https://example.test/api/dekan/dorm', {
      method: 'PATCH', body: JSON.stringify({ action: 'withdraw', floors: [2, 3] }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ dorm: { id: 'd1' } })
  })

  it('patches attendance settings on the "attendance-settings" action', async () => {
    mocks.patchOwnDorm.mockResolvedValue({ id: 'd1' })
    const res = await PATCH(req('https://example.test/api/dekan/dorm', {
      method: 'PATCH', body: JSON.stringify({ action: 'attendance-settings', settings: { lat: 41.3 } }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.patchOwnDorm).toHaveBeenCalledWith(expect.anything(), { lat: 41.3 }, undefined)
  })

  it('400s "set-primary" with no dormId', async () => {
    const res = await PATCH(req('https://example.test/api/dekan/dorm', {
      method: 'PATCH', body: JSON.stringify({ action: 'set-primary' }),
    }))
    expect(res.status).toBe(400)
    expect(mocks.setPrimary).not.toHaveBeenCalled()
  })

  it('sets a dorm as primary on success', async () => {
    mocks.setPrimary.mockResolvedValue([{ id: 'd1', primary: true }])
    const res = await PATCH(req('https://example.test/api/dekan/dorm', {
      method: 'PATCH', body: JSON.stringify({ action: 'set-primary', dormId: 'd1' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ dorms: [{ id: 'd1', primary: true }] })
  })

  it('400s "unlink" with no dormId', async () => {
    const res = await PATCH(req('https://example.test/api/dekan/dorm', {
      method: 'PATCH', body: JSON.stringify({ action: 'unlink' }),
    }))
    expect(res.status).toBe(400)
    expect(mocks.unlinkDorm).not.toHaveBeenCalled()
  })

  it('unlinks a dorm on success', async () => {
    mocks.unlinkDorm.mockResolvedValue([])
    const res = await PATCH(req('https://example.test/api/dekan/dorm', {
      method: 'PATCH', body: JSON.stringify({ action: 'unlink', dormId: 'd1' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ dorms: [] })
  })

  it('500s when a sub-action throws unexpectedly', async () => {
    mocks.resolve.mockRejectedValue(new Error('db down'))
    const res = await PATCH(req('https://example.test/api/dekan/dorm', {
      method: 'PATCH', body: JSON.stringify({ action: 'resolve', floor: 3, accept: true }),
    }))
    expect(res.status).toBe(500)
  })
})
