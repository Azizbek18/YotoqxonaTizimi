import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  submit: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStudent: mocks.requireActiveStudent }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: mocks.getClientIp }))
vi.mock('@/features/applications/server/service', () => ({
  createApplicationService: () => ({
    list: mocks.list, create: mocks.create, submit: mocks.submit, remove: mocks.remove,
  }),
}))

const { GET, POST, PATCH, DELETE } = await import('./route')

function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getClientIp.mockReturnValue('127.0.0.1')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
  mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1' } })
})

describe('GET /api/student/applications', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/student/applications'))
    expect(res.status).toBe(401)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.list.mockRejectedValue(new Error('db down'))
    const res = await GET(req('https://example.test/api/student/applications'))
    expect(res.status).toBe(500)
  })

  it('lists the student’s applications on success', async () => {
    mocks.list.mockResolvedValue([{ id: 'app1' }])
    const res = await GET(req('https://example.test/api/student/applications?kind=справка&limit=10'))
    expect(res.status).toBe(200)
    expect(mocks.list).toHaveBeenCalledWith('s1', 'справка', '10')
  })
})

describe('POST /api/student/applications', () => {
  it('403s a blacklisted/inactive student', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(403, 'Faol talaba profili talab qilinadi', 'FORBIDDEN'))
    const res = await POST(req('https://example.test/api/student/applications', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(403)
  })

  it('429s when the submit rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(req('https://example.test/api/student/applications', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(429)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('400s a validation failure surfaced by the service', async () => {
    mocks.create.mockRejectedValue(new ApiError(400, 'Turi noto‘g‘ri'))
    const res = await POST(req('https://example.test/api/student/applications', {
      method: 'POST', body: JSON.stringify({ kind: 'unknown' }),
    }))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.create.mockRejectedValue(new Error('db down'))
    const res = await POST(req('https://example.test/api/student/applications', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(500)
  })

  it('creates the application on success', async () => {
    mocks.create.mockResolvedValue({ id: 'app1' })
    const res = await POST(req('https://example.test/api/student/applications', {
      method: 'POST', body: JSON.stringify({ kind: 'справка' }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'app1' })
  })
})

describe('PATCH /api/student/applications (submit/sign)', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await PATCH(req('https://example.test/api/student/applications', { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('400s when the signature is missing (service enforces it)', async () => {
    mocks.submit.mockRejectedValue(new ApiError(400, 'Arizani yuborishdan oldin imzolang'))
    const res = await PATCH(req('https://example.test/api/student/applications', {
      method: 'PATCH', body: JSON.stringify({ id: 'app1' }),
    }))
    expect(res.status).toBe(400)
  })

  it('tolerates an unparsable JSON body (empty object fallback)', async () => {
    mocks.submit.mockRejectedValue(new ApiError(400, 'id kerak'))
    const res = await PATCH(new NextRequest('https://example.test/api/student/applications', {
      method: 'PATCH', body: 'not json', headers: { 'content-type': 'application/json' },
    }))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.submit.mockRejectedValue(new Error('db down'))
    const res = await PATCH(req('https://example.test/api/student/applications', {
      method: 'PATCH', body: JSON.stringify({ id: 'app1', signature: { attested: true, name: 'A' } }),
    }))
    expect(res.status).toBe(500)
  })

  it('submits/signs the application on success', async () => {
    mocks.submit.mockResolvedValue({ id: 'app1', status: 'submitted' })
    const res = await PATCH(req('https://example.test/api/student/applications', {
      method: 'PATCH', body: JSON.stringify({ id: 'app1', signature: { attested: true, name: 'A' } }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ id: 'app1', status: 'submitted' })
  })
})

describe('DELETE /api/student/applications', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await DELETE(req('https://example.test/api/student/applications?id=app1'))
    expect(res.status).toBe(401)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.remove.mockRejectedValue(new Error('db down'))
    const res = await DELETE(req('https://example.test/api/student/applications?id=app1'))
    expect(res.status).toBe(500)
  })

  it('removes the application on success', async () => {
    mocks.remove.mockResolvedValue({ ok: true })
    const res = await DELETE(req('https://example.test/api/student/applications?id=app1'))
    expect(res.status).toBe(200)
    expect(mocks.remove).toHaveBeenCalledWith('s1', 'app1')
  })
})
