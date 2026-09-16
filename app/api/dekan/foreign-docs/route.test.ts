import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  requirePickedFaculty: vi.fn(),
  checkRateLimit: vi.fn(),
  listForFaculty: vi.fn(),
  patchByStaff: vi.fn(),
  addByStaff: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/server/auth/faculty', () => ({ requirePickedFaculty: mocks.requirePickedFaculty }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/features/foreign-docs/server/service', () => ({
  createForeignDocsService: () => ({
    listForFaculty: mocks.listForFaculty, patchByStaff: mocks.patchByStaff, addByStaff: mocks.addByStaff,
  }),
}))

const { GET, PATCH, POST } = await import('./route')

const VALID_DOC_ID = '11111111-2222-3333-4444-555555555555'

function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'staff1', role: 'dekan', faculty: 'amit' } })
  mocks.requirePickedFaculty.mockReturnValue('amit')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
})

describe('GET /api/dekan/foreign-docs', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/dekan/foreign-docs'))
    expect(res.status).toBe(401)
  })

  it('403s a role outside dekan/admin', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await GET(req('https://example.test/api/dekan/foreign-docs'))
    expect(res.status).toBe(403)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.listForFaculty.mockRejectedValue(new Error('db down'))
    const res = await GET(req('https://example.test/api/dekan/foreign-docs'))
    expect(res.status).toBe(500)
  })

  it('returns the faculty-scoped doc list on success', async () => {
    mocks.listForFaculty.mockResolvedValue([{ id: VALID_DOC_ID }])
    const res = await GET(req('https://example.test/api/dekan/foreign-docs'))
    expect(res.status).toBe(200)
    expect(mocks.listForFaculty).toHaveBeenCalledWith('amit')
  })
})

describe('PATCH /api/dekan/foreign-docs', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await PATCH(req(`https://example.test/api/dekan/foreign-docs?id=${VALID_DOC_ID}`, { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('429s when the rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await PATCH(req(`https://example.test/api/dekan/foreign-docs?id=${VALID_DOC_ID}`, { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(429)
    expect(mocks.patchByStaff).not.toHaveBeenCalled()
  })

  it('400s a malformed id', async () => {
    const res = await PATCH(req('https://example.test/api/dekan/foreign-docs?id=not-a-uuid', { method: 'PATCH', body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('400s an unparsable body', async () => {
    const res = await PATCH(new NextRequest(`https://example.test/api/dekan/foreign-docs?id=${VALID_DOC_ID}`, {
      method: 'PATCH', body: 'not json', headers: { 'content-type': 'application/json' },
    }))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.patchByStaff.mockRejectedValue(new Error('db down'))
    const res = await PATCH(req(`https://example.test/api/dekan/foreign-docs?id=${VALID_DOC_ID}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'approved' }),
    }))
    expect(res.status).toBe(500)
  })

  it('patches the doc on success', async () => {
    mocks.patchByStaff.mockResolvedValue({ id: VALID_DOC_ID, status: 'approved' })
    const res = await PATCH(req(`https://example.test/api/dekan/foreign-docs?id=${VALID_DOC_ID}`, {
      method: 'PATCH', body: JSON.stringify({ status: 'approved' }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.patchByStaff).toHaveBeenCalledWith(VALID_DOC_ID, 'amit', { status: 'approved' }, 'staff1')
  })
})

describe('POST /api/dekan/foreign-docs', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await POST(req('https://example.test/api/dekan/foreign-docs', { method: 'POST', body: '{}' }))
    expect(res.status).toBe(401)
  })

  it('400s a missing studentId', async () => {
    const res = await POST(req('https://example.test/api/dekan/foreign-docs', {
      method: 'POST', body: JSON.stringify({ docType: 'passport' }),
    }))
    expect(res.status).toBe(400)
    expect(mocks.addByStaff).not.toHaveBeenCalled()
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.addByStaff.mockRejectedValue(new Error('db down'))
    const res = await POST(req('https://example.test/api/dekan/foreign-docs', {
      method: 'POST', body: JSON.stringify({ studentId: 's1', docType: 'passport' }),
    }))
    expect(res.status).toBe(500)
  })

  it('adds the doc as "dekan" role on success', async () => {
    mocks.addByStaff.mockResolvedValue({ id: VALID_DOC_ID })
    const res = await POST(req('https://example.test/api/dekan/foreign-docs', {
      method: 'POST', body: JSON.stringify({ studentId: 's1', docType: 'passport' }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.addByStaff).toHaveBeenCalledWith('s1', 'amit', expect.objectContaining({ studentId: 's1' }), 'dekan')
  })

  it('adds the doc as "admin" role for a superadmin caller', async () => {
    mocks.requireActiveStaff.mockResolvedValue({ staff: { id: 'admin1', role: 'admin', faculty: 'amit' } })
    mocks.addByStaff.mockResolvedValue({ id: VALID_DOC_ID })
    const res = await POST(req('https://example.test/api/dekan/foreign-docs', {
      method: 'POST', body: JSON.stringify({ studentId: 's1', docType: 'passport' }),
    }))
    expect(res.status).toBe(200)
    expect(mocks.addByStaff).toHaveBeenCalledWith('s1', 'amit', expect.anything(), 'admin')
  })
})
