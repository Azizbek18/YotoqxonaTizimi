import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  roomGrantGrid: vi.fn(),
  grantRoom: vi.fn(),
  ungrantRoom: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/features/dorms/server/service', () => ({
  createDormService: () => ({ roomGrantGrid: mocks.roomGrantGrid, grantRoom: mocks.grantRoom, ungrantRoom: mocks.ungrantRoom }),
}))

const { GET, POST } = await import('./route')

function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'admin1', role: 'admin' } })
})

describe('GET /api/admin/dorms/room-grants', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/admin/dorms/room-grants?dormId=d1'))
    expect(res.status).toBe(401)
  })

  it('400s a missing dormId', async () => {
    const res = await GET(req('https://example.test/api/admin/dorms/room-grants'))
    expect(res.status).toBe(400)
    expect(mocks.roomGrantGrid).not.toHaveBeenCalled()
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.roomGrantGrid.mockRejectedValue(new Error('db down'))
    const res = await GET(req('https://example.test/api/admin/dorms/room-grants?dormId=d1'))
    expect(res.status).toBe(500)
  })

  it('returns the room-grant grid on success', async () => {
    mocks.roomGrantGrid.mockResolvedValue({ rooms: [] })
    const res = await GET(req('https://example.test/api/admin/dorms/room-grants?dormId=d1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ grid: { rooms: [] } })
  })
})

describe('POST /api/admin/dorms/room-grants', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await POST(req('https://example.test/api/admin/dorms/room-grants', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('400s an unrecognised action', async () => {
    const res = await POST(req('https://example.test/api/admin/dorms/room-grants', {
      method: 'POST', body: JSON.stringify({ action: 'nonsense' }),
    }))
    expect(res.status).toBe(400)
  })

  it('500s when grant throws unexpectedly', async () => {
    mocks.grantRoom.mockRejectedValue(new Error('db down'))
    const res = await POST(req('https://example.test/api/admin/dorms/room-grants', {
      method: 'POST', body: JSON.stringify({ action: 'grant', dormId: 'd1', roomNumber: '101', faculty: 'amit' }),
    }))
    expect(res.status).toBe(500)
  })

  it('grants a room on success, passing the acting staff id', async () => {
    mocks.grantRoom.mockResolvedValue({ granted: true })
    const res = await POST(req('https://example.test/api/admin/dorms/room-grants', {
      method: 'POST', body: JSON.stringify({ action: 'grant', dormId: 'd1', roomNumber: '101', faculty: 'amit' }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.grantRoom).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'grant', roomNumber: '101' }),
      'admin1',
    )
  })

  it('400s a validation failure from ungrant surfaced by the service', async () => {
    mocks.ungrantRoom.mockRejectedValue(new ApiError(400, 'Xona berilmagan'))
    const res = await POST(req('https://example.test/api/admin/dorms/room-grants', {
      method: 'POST', body: JSON.stringify({ action: 'ungrant', dormId: 'd1', roomNumber: '101' }),
    }))
    expect(res.status).toBe(400)
  })

  it('ungrants a room on success', async () => {
    mocks.ungrantRoom.mockResolvedValue({ ungranted: true })
    const res = await POST(req('https://example.test/api/admin/dorms/room-grants', {
      method: 'POST', body: JSON.stringify({ action: 'ungrant', dormId: 'd1', roomNumber: '101' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, ungranted: true })
  })
})
