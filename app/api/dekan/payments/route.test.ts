import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  requirePickedFaculty: vi.fn(),
  getSummary: vi.fn(),
  listAll: vi.fn(),
  review: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/server/auth/faculty', () => ({ requirePickedFaculty: mocks.requirePickedFaculty }))
vi.mock('@/features/payments/server/service', () => ({
  createPaymentService: () => ({ getSummary: mocks.getSummary, listAll: mocks.listAll, review: mocks.review }),
}))

const { GET, PATCH } = await import('./route')

const URL_ = 'https://example.test/api/dekan/payments'
const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(url, init)

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'dekan1', role: 'dekan', faculty: 'amit' } })
  mocks.requirePickedFaculty.mockReturnValue('amit')
})

describe('GET /api/dekan/payments', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    expect((await GET(req(URL_))).status).toBe(401)
  })

  it('only admits dekan and superadmin', async () => {
    await GET(req(URL_))
    expect(mocks.requireActiveStaff.mock.calls[0][1]).toEqual(['dekan', 'admin'])
  })

  it('asks a superadmin with no faculty picked to pick one', async () => {
    mocks.requirePickedFaculty.mockImplementation(() => { throw new ApiError(400, 'Avval fakultetni tanlang', 'SCOPE_REQUIRED') })
    expect((await GET(req(URL_))).status).toBe(400)
  })

  it('400s an invalid studentId filter', async () => {
    expect((await GET(req(`${URL_}?studentId=nope`))).status).toBe(400)
  })

  it('lists payments scoped to the dekan\'s own faculty only', async () => {
    mocks.listAll.mockResolvedValue([{ id: 'p1' }])
    const res = await GET(req(URL_))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ payments: [{ id: 'p1' }] })
    expect(mocks.listAll).toHaveBeenCalledWith(['amit'], undefined)
  })

  it('returns the waiting count for ?summary=1', async () => {
    mocks.getSummary.mockResolvedValue({ waitingCount: 4 })
    const res = await GET(req(`${URL_}?summary=1`))
    expect(await res.json()).toEqual({ waitingCount: 4 })
    expect(mocks.getSummary).toHaveBeenCalledWith(['amit'])
  })
})

describe('PATCH /api/dekan/payments', () => {
  it('400s a missing body', async () => {
    expect((await PATCH(req(URL_, { method: 'PATCH', body: 'not json' }))).status).toBe(400)
  })

  it('approves/rejects only within the dekan\'s own faculty', async () => {
    mocks.review.mockResolvedValue({ ok: true })
    const body = { ids: ['a'], status: 'approved', message: 'ok' }
    const res = await PATCH(req(URL_, { method: 'PATCH', body: JSON.stringify(body) }))
    expect(res.status).toBe(200)
    expect(mocks.review).toHaveBeenCalledWith(['amit'], body)
  })
})
