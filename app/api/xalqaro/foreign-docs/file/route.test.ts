import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/server/http/api-error'

const requireActiveStaff = vi.fn()
const checkRateLimit = vi.fn()
const getForInternationalFileAccess = vi.fn()
const createSignedUrl = vi.fn()
const writeAuditLog = vi.fn()

vi.mock('@/server/auth/guards', () => ({ requireActiveStaff: (...a: unknown[]) => requireActiveStaff(...a) }))
vi.mock('@/lib/security', () => ({
  checkRateLimit: (...a: unknown[]) => checkRateLimit(...a),
  getClientIp: () => '10.0.0.1',
}))
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: (...a: unknown[]) => writeAuditLog(...a) }))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({ storage: { from: () => ({ createSignedUrl: (...a: unknown[]) => createSignedUrl(...a) }) } }),
}))
vi.mock('@/features/foreign-docs/server/service', () => ({
  createForeignDocsService: () => ({ getForInternationalFileAccess }),
}))

const { GET } = await import('./route')

const ID = '11111111-1111-4111-8111-111111111111'
const req = (id: string | null = ID) =>
  new NextRequest(`http://localhost/api/xalqaro/foreign-docs/file${id === null ? '' : `?id=${id}`}`)
const STAFF = { user: { id: 'x-1' }, staff: { id: 'x-1', role: 'xalqaro' } }

beforeEach(() => {
  vi.clearAllMocks()
  checkRateLimit.mockResolvedValue({ allowed: true })
  requireActiveStaff.mockResolvedValue(STAFF)
  getForInternationalFileAccess.mockResolvedValue({ filePath: 'foreign-docs/s1/d1/scan.jpg', studentId: 's1' })
  createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://signed.example/x' }, error: null })
})

describe('GET /api/xalqaro/foreign-docs/file', () => {
  it('returns a 60s signed URL and records who opened which document', async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ url: 'https://signed.example/x' })
    expect(requireActiveStaff).toHaveBeenCalledWith(expect.anything(), ['xalqaro', 'admin'])
    expect(createSignedUrl).toHaveBeenCalledWith('foreign-docs/s1/d1/scan.jpg', 60, undefined)
    expect(writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'xalqaro.foreign_doc_file_opened',
      actorUserId: 'x-1',
      details: expect.objectContaining({ documentId: ID, studentId: 's1' }),
    }))
  })

  it('forces a download for PDFs', async () => {
    getForInternationalFileAccess.mockResolvedValue({ filePath: 'foreign-docs/s1/d1/visa.PDF', studentId: 's1' })
    await GET(req())
    expect(createSignedUrl).toHaveBeenCalledWith('foreign-docs/s1/d1/visa.PDF', 60, { download: true })
  })

  it('403s any other role before touching the document', async () => {
    requireActiveStaff.mockRejectedValue(new ApiError(403, 'Bu amal uchun ruxsat yo‘q', 'FORBIDDEN'))
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect(getForInternationalFileAccess).not.toHaveBeenCalled()
    expect(writeAuditLog).not.toHaveBeenCalled()
  })

  it('400s a malformed id', async () => {
    expect((await GET(req('not an id'))).status).toBe(400)
    expect((await GET(req(null))).status).toBe(400)
    expect(getForInternationalFileAccess).not.toHaveBeenCalled()
  })

  it('passes the service refusal through (lease contract / non-foreign student) and does not audit a success', async () => {
    getForInternationalFileAccess.mockRejectedValue(new ApiError(403, 'Ruxsat berilmadi'))
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect(createSignedUrl).not.toHaveBeenCalled()
    expect(writeAuditLog).not.toHaveBeenCalled()
  })

  it('throttles', async () => {
    checkRateLimit.mockResolvedValue({ allowed: false })
    expect((await GET(req())).status).toBe(429)
    expect(getForInternationalFileAccess).not.toHaveBeenCalled()
  })
})
