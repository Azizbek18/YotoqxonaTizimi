import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStaff: vi.fn(),
  getForFileAccess: vi.fn(),
  createSignedUrl: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: mocks.requireActiveStaff }))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({ storage: { from: () => ({ createSignedUrl: mocks.createSignedUrl }) } }),
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
  mocks.requireActiveStaff.mockResolvedValue({ user: { id: 'staff1' } })
  mocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/x' }, error: null })
})

describe('GET /api/dekan/foreign-docs/file', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req(`https://example.test/api/dekan/foreign-docs/file?id=${VALID_DOC_ID}`))
    expect(res.status).toBe(401)
  })

  it('403s a role outside dekan/admin', async () => {
    mocks.requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await GET(req(`https://example.test/api/dekan/foreign-docs/file?id=${VALID_DOC_ID}`))
    expect(res.status).toBe(403)
  })

  it('400s a malformed id', async () => {
    const res = await GET(req('https://example.test/api/dekan/foreign-docs/file?id=not-a-uuid'))
    expect(res.status).toBe(400)
    expect(mocks.getForFileAccess).not.toHaveBeenCalled()
  })

  it('403s (via the service) a doc outside the staff’s scope', async () => {
    mocks.getForFileAccess.mockRejectedValue(new ApiError(403, 'Bu hujjat sizga tegishli emas'))
    const res = await GET(req(`https://example.test/api/dekan/foreign-docs/file?id=${VALID_DOC_ID}`))
    expect(res.status).toBe(403)
  })

  it('500s when Supabase Storage fails to sign the URL', async () => {
    mocks.getForFileAccess.mockResolvedValue({ filePath: 'foreign-docs/s1/doc1/x.jpg' })
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: new Error('storage down') })
    const res = await GET(req(`https://example.test/api/dekan/foreign-docs/file?id=${VALID_DOC_ID}`))
    expect(res.status).toBe(500)
  })

  it('returns the signed URL on success, always as staff', async () => {
    mocks.getForFileAccess.mockResolvedValue({ filePath: 'foreign-docs/s1/doc1/x.jpg' })
    const res = await GET(req(`https://example.test/api/dekan/foreign-docs/file?id=${VALID_DOC_ID}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://signed.example/x' })
    expect(mocks.getForFileAccess).toHaveBeenCalledWith(VALID_DOC_ID, { userId: 'staff1', isStaff: true })
  })
})
