import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  getRequestUser: vi.fn(),
  staffMaybeSingle: vi.fn(),
  getForFileAccess: vi.fn(),
  createSignedUrl: vi.fn(),
}))

vi.mock('@/lib/server-auth', () => ({ getRequestUser: mocks.getRequestUser }))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.staffMaybeSingle }) }) }),
    storage: { from: () => ({ createSignedUrl: mocks.createSignedUrl }) },
  }),
}))
vi.mock('@/features/foreign-docs/server/service', () => ({
  createForeignDocsService: () => ({ getForFileAccess: mocks.getForFileAccess }),
}))

const { GET } = await import('./route')

const VALID_DOC_ID = '11111111-2222-3333-4444-555555555555'

function req(url: string) {
  return new NextRequest(url)
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getRequestUser.mockResolvedValue({ id: 'u1' })
  mocks.staffMaybeSingle.mockResolvedValue({ data: null, error: null })
  mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/x' }, error: null })
})

describe('GET /api/student/foreign-docs/file', () => {
  it('401s without a session', async () => {
    mocks.getRequestUser.mockResolvedValue(null)
    const res = await GET(req(`https://example.test/api/student/foreign-docs/file?id=${VALID_DOC_ID}`))
    expect(res.status).toBe(401)
  })

  it('400s a malformed id', async () => {
    const res = await GET(req('https://example.test/api/student/foreign-docs/file?id=not-a-uuid'))
    expect(res.status).toBe(400)
    expect(mocks.getForFileAccess).not.toHaveBeenCalled()
  })

  it('403s (via the service) a non-owner, non-staff caller', async () => {
    mocks.getForFileAccess.mockRejectedValue(new ApiError(403, 'Bu hujjat sizga tegishli emas'))
    const res = await GET(req(`https://example.test/api/student/foreign-docs/file?id=${VALID_DOC_ID}`))
    expect(res.status).toBe(403)
  })

  it('passes isStaff: false for a plain student', async () => {
    mocks.getForFileAccess.mockResolvedValue({ filePath: 'foreign-docs/u1/doc1/x.jpg' })
    await GET(req(`https://example.test/api/student/foreign-docs/file?id=${VALID_DOC_ID}`))
    expect(mocks.getForFileAccess).toHaveBeenCalledWith(VALID_DOC_ID, { userId: 'u1' })
  })

  it('never grants staff access here — even an active dekan is owner-only on this route', async () => {
    mocks.staffMaybeSingle.mockResolvedValue({ data: { role: 'dekan', status: 'active' }, error: null })
    mocks.getForFileAccess.mockResolvedValue({ filePath: 'foreign-docs/u1/doc1/x.jpg' })
    await GET(req(`https://example.test/api/student/foreign-docs/file?id=${VALID_DOC_ID}`))
    expect(mocks.getForFileAccess).toHaveBeenCalledWith(VALID_DOC_ID, { userId: 'u1' })
  })

  it('500s when Supabase Storage fails to sign the URL', async () => {
    mocks.getForFileAccess.mockResolvedValue({ filePath: 'foreign-docs/u1/doc1/x.jpg' })
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: new Error('storage down') })
    const res = await GET(req(`https://example.test/api/student/foreign-docs/file?id=${VALID_DOC_ID}`))
    expect(res.status).toBe(500)
  })

  it('returns the signed URL on success', async () => {
    mocks.getForFileAccess.mockResolvedValue({ filePath: 'foreign-docs/u1/doc1/x.jpg' })
    const res = await GET(req(`https://example.test/api/student/foreign-docs/file?id=${VALID_DOC_ID}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://signed.example/x' })
  })

  it('forces a download disposition for a PDF', async () => {
    mocks.getForFileAccess.mockResolvedValue({ filePath: 'foreign-docs/u1/doc1/x.pdf' })
    await GET(req(`https://example.test/api/student/foreign-docs/file?id=${VALID_DOC_ID}`))
    expect(mocks.createSignedUrl).toHaveBeenCalledWith('foreign-docs/u1/doc1/x.pdf', 60, { download: true })
  })
})
