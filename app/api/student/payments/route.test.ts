import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  readMultipartForm: vi.fn(),
  listForStudent: vi.fn(),
  submit: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStudent: mocks.requireActiveStudent }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: mocks.getClientIp }))
vi.mock('@/lib/upload-limits', () => ({ readMultipartForm: mocks.readMultipartForm }))
vi.mock('@/features/payments/server/service', () => ({
  createPaymentService: () => ({ listForStudent: mocks.listForStudent, submit: mocks.submit }),
}))

const { GET, POST } = await import('./route')

function req(init?: RequestInit) {
  return new Request('https://example.test/api/student/payments', init) as never
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getClientIp.mockReturnValue('127.0.0.1')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
})

describe('GET /api/student/payments', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req())
    expect(res.status).toBe(401)
  })

  it('403s a blacklisted/inactive student', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(403, 'Faol talaba profili talab qilinadi', 'FORBIDDEN'))
    const res = await GET(req())
    expect(res.status).toBe(403)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1' } })
    mocks.listForStudent.mockRejectedValue(new Error('db down'))
    const res = await GET(req())
    expect(res.status).toBe(500)
  })

  it('returns the student’s payments on success', async () => {
    mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1' } })
    mocks.listForStudent.mockResolvedValue([{ id: 'p1' }])
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ payments: [{ id: 'p1' }] })
    expect(mocks.listForStudent).toHaveBeenCalledWith('s1')
  })
})

describe('POST /api/student/payments', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await POST(req({ method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('429s when the submit rate limit is exceeded', async () => {
    mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1' } })
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(req({ method: 'POST' }))
    expect(res.status).toBe(429)
    expect(mocks.submit).not.toHaveBeenCalled()
  })

  it('400s on a malformed multipart upload', async () => {
    mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1' } })
    mocks.readMultipartForm.mockRejectedValue(new ApiError(415, 'multipart/form-data so‘rovi talab qilinadi'))
    const res = await POST(req({ method: 'POST' }))
    expect(res.status).toBe(415)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1' } })
    mocks.readMultipartForm.mockResolvedValue({})
    mocks.submit.mockRejectedValue(new Error('db down'))
    const res = await POST(req({ method: 'POST' }))
    expect(res.status).toBe(500)
  })

  it('creates the payment on success', async () => {
    mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1' } })
    mocks.readMultipartForm.mockResolvedValue({ amount: '100000' })
    mocks.submit.mockResolvedValue({ id: 'p1', status: 'pending' })
    const res = await POST(req({ method: 'POST' }))
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ id: 'p1', status: 'pending' })
  })
})
