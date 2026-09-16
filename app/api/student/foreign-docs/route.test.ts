import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { ApiError } from '@/server/http/api-error'

const mocks = vi.hoisted(() => ({
  requireActiveStudent: vi.fn(),
  checkRateLimit: vi.fn(),
  readMultipartForm: vi.fn(),
  listForStudent: vi.fn(),
  saveForStudent: vi.fn(),
  attachFile: vi.fn(),
  deleteForStudent: vi.fn(),
  appSettingsGet: vi.fn(),
  storageUpload: vi.fn(),
  storageList: vi.fn(),
  storageRemove: vi.fn(),
}))

vi.mock('@/server/auth/guards', () => ({ requireActiveStudent: mocks.requireActiveStudent }))
vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit }))
vi.mock('@/lib/upload-limits', () => ({
  readMultipartForm: mocks.readMultipartForm,
  MAX_UPLOAD_SIZE_BYTES: 4 * 1024 * 1024,
}))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    storage: { from: () => ({ upload: mocks.storageUpload, list: mocks.storageList, remove: mocks.storageRemove }) },
  }),
}))
vi.mock('@/features/app-settings/server/service', () => ({
  createAppSettingsService: () => ({ get: mocks.appSettingsGet }),
}))
vi.mock('@/features/foreign-docs/server/service', () => ({
  createForeignDocsService: () => ({
    listForStudent: mocks.listForStudent,
    saveForStudent: mocks.saveForStudent,
    attachFile: mocks.attachFile,
    deleteForStudent: mocks.deleteForStudent,
  }),
}))

const { GET, POST, DELETE } = await import('./route')

function req(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init)
}

const VALID_DOC_ID = '11111111-2222-3333-4444-555555555555'
// A valid JPEG signature (0xFF 0xD8 0xFF) padded to >=16 bytes.
const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, ...new Array(20).fill(0)])

beforeEach(() => {
  vi.resetAllMocks()
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
  mocks.requireActiveStudent.mockResolvedValue({ student: { id: 's1' } })
  mocks.appSettingsGet.mockResolvedValue({ maxUploadSizeMb: 4 })
  mocks.storageList.mockResolvedValue({ data: [], error: null })
  mocks.storageRemove.mockResolvedValue({ data: null, error: null })
  mocks.storageUpload.mockResolvedValue({ data: { path: 'x' }, error: null })
})

describe('GET /api/student/foreign-docs', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await GET(req('https://example.test/api/student/foreign-docs'))
    expect(res.status).toBe(401)
  })

  it('is reachable for a blacklisted student (read-only, allowBlacklisted)', async () => {
    mocks.listForStudent.mockResolvedValue([{ id: VALID_DOC_ID }])
    const res = await GET(req('https://example.test/api/student/foreign-docs'))
    expect(res.status).toBe(200)
    expect(mocks.requireActiveStudent).toHaveBeenCalledWith(expect.anything(), { allowBlacklisted: true })
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.listForStudent.mockRejectedValue(new Error('db down'))
    const res = await GET(req('https://example.test/api/student/foreign-docs'))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/student/foreign-docs', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await POST(req('https://example.test/api/student/foreign-docs', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('429s when the save rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(req('https://example.test/api/student/foreign-docs', { method: 'POST' }))
    expect(res.status).toBe(429)
    expect(mocks.saveForStudent).not.toHaveBeenCalled()
  })

  it('400s a form missing the payload field', async () => {
    mocks.readMultipartForm.mockResolvedValue(new Map())
    const res = await POST(req('https://example.test/api/student/foreign-docs', { method: 'POST' }))
    expect(res.status).toBe(400)
  })

  it('400s an unparsable payload JSON string', async () => {
    mocks.readMultipartForm.mockResolvedValue(new Map<string, unknown>([['payload', 'not-json']]))
    const res = await POST(req('https://example.test/api/student/foreign-docs', { method: 'POST' }))
    expect(res.status).toBe(400)
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.readMultipartForm.mockResolvedValue(new Map<string, unknown>([['payload', JSON.stringify({ docType: 'passport' })]]))
    mocks.saveForStudent.mockRejectedValue(new Error('db down'))
    const res = await POST(req('https://example.test/api/student/foreign-docs', { method: 'POST' }))
    expect(res.status).toBe(500)
  })

  it('saves the document with no file on success', async () => {
    mocks.readMultipartForm.mockResolvedValue(new Map<string, unknown>([['payload', JSON.stringify({ docType: 'passport' })]]))
    mocks.saveForStudent.mockResolvedValue({ id: VALID_DOC_ID, hasFile: false })
    const res = await POST(req('https://example.test/api/student/foreign-docs', { method: 'POST' }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ doc: { id: VALID_DOC_ID, hasFile: false } })
    expect(mocks.storageUpload).not.toHaveBeenCalled()
  })

  it('400s an oversized file (keeps the already-saved doc in the response)', async () => {
    const bigFile = new File([new Uint8Array(5 * 1024 * 1024)], 'p.jpg')
    const form = new Map<string, unknown>([['payload', JSON.stringify({ docType: 'passport' })], ['file', bigFile]])
    mocks.readMultipartForm.mockResolvedValue(form)
    mocks.saveForStudent.mockResolvedValue({ id: VALID_DOC_ID, hasFile: false })
    const res = await POST(req('https://example.test/api/student/foreign-docs', { method: 'POST' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.doc.id).toBe(VALID_DOC_ID)
    expect(mocks.storageUpload).not.toHaveBeenCalled()
  })

  it('400s a file with an unrecognised signature (not a real JPG/PNG/WEBP/PDF)', async () => {
    const badFile = new File([new Uint8Array(20).fill(0)], 'p.jpg')
    const form = new Map<string, unknown>([['payload', JSON.stringify({ docType: 'passport' })], ['file', badFile]])
    mocks.readMultipartForm.mockResolvedValue(form)
    mocks.saveForStudent.mockResolvedValue({ id: VALID_DOC_ID, hasFile: false })
    const res = await POST(req('https://example.test/api/student/foreign-docs', { method: 'POST' }))
    expect(res.status).toBe(400)
    expect(mocks.storageUpload).not.toHaveBeenCalled()
  })

  it('uploads a valid file, cleans up the stale one, and attaches it', async () => {
    const goodFile = new File([jpegBytes], 'p.jpg')
    const form = new Map<string, unknown>([['payload', JSON.stringify({ docType: 'passport' })], ['file', goodFile]])
    mocks.readMultipartForm.mockResolvedValue(form)
    mocks.saveForStudent.mockResolvedValue({ id: VALID_DOC_ID, hasFile: false })
    mocks.storageList.mockResolvedValue({ data: [{ name: 'old-file.jpg' }], error: null })
    mocks.attachFile.mockResolvedValue(undefined)

    const res = await POST(req('https://example.test/api/student/foreign-docs', { method: 'POST' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.doc.hasFile).toBe(true)
    expect(mocks.storageUpload).toHaveBeenCalled()
    expect(mocks.storageRemove).toHaveBeenCalledWith([`foreign-docs/s1/${VALID_DOC_ID}/old-file.jpg`])
    expect(mocks.attachFile).toHaveBeenCalled()
  })
})

describe('DELETE /api/student/foreign-docs', () => {
  it('401s without a session', async () => {
    mocks.requireActiveStudent.mockRejectedValue(new ApiError(401, 'Autentifikatsiya talab qilinadi', 'UNAUTHENTICATED'))
    const res = await DELETE(req(`https://example.test/api/student/foreign-docs?id=${VALID_DOC_ID}`))
    expect(res.status).toBe(401)
  })

  it('400s a malformed id', async () => {
    const res = await DELETE(req('https://example.test/api/student/foreign-docs?id=not-a-uuid'))
    expect(res.status).toBe(400)
    expect(mocks.deleteForStudent).not.toHaveBeenCalled()
  })

  it('500s when the service throws unexpectedly', async () => {
    mocks.deleteForStudent.mockRejectedValue(new Error('db down'))
    const res = await DELETE(req(`https://example.test/api/student/foreign-docs?id=${VALID_DOC_ID}`))
    expect(res.status).toBe(500)
  })

  it('deletes the doc and its file on success', async () => {
    mocks.deleteForStudent.mockResolvedValue(undefined)
    mocks.storageList.mockResolvedValue({ data: [{ name: 'f.jpg' }], error: null })
    const res = await DELETE(req(`https://example.test/api/student/foreign-docs?id=${VALID_DOC_ID}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mocks.storageRemove).toHaveBeenCalledWith([`foreign-docs/s1/${VALID_DOC_ID}/f.jpg`])
  })

  it('still returns ok:true even when best-effort file cleanup fails', async () => {
    mocks.deleteForStudent.mockResolvedValue(undefined)
    mocks.storageList.mockRejectedValue(new Error('storage down'))
    const res = await DELETE(req(`https://example.test/api/student/foreign-docs?id=${VALID_DOC_ID}`))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
