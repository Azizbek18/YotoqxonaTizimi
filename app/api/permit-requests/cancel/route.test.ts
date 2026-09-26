import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  writeAuditLog: vi.fn(),
  selectMaybeSingle: vi.fn(),
  deleteSelect: vi.fn(),
  storageRemove: vi.fn(),
}))

vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: mocks.getClientIp }))
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: mocks.writeAuditLog }))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              is: () => ({ maybeSingle: mocks.selectMaybeSingle }),
              eq: () => ({ maybeSingle: mocks.selectMaybeSingle }),
            }),
          }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          eq: () => ({ select: mocks.deleteSelect }),
        }),
      }),
    }),
    storage: { from: () => ({ remove: mocks.storageRemove }) },
  }),
}))

const emailProof = vi.hoisted(() => ({ ok: true }))
vi.mock('@/lib/email-proof', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email-proof')>()),
  hasEmailProof: () => emailProof.ok,
}))
beforeEach(() => { emailProof.ok = true })

const { POST } = await import('./route')

function req(body: unknown) {
  return new NextRequest('https://example.test/api/permit-requests/cancel', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const validYollanma = {
  passportSeries: 'AB1234567',
  jshshir: '12345678901234',
  email: 'student@example.com',
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getClientIp.mockReturnValue('127.0.0.1')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
  mocks.writeAuditLog.mockResolvedValue(undefined)
  mocks.storageRemove.mockResolvedValue({ data: null, error: null })
})

describe('POST /api/permit-requests/cancel', () => {
  it('429s when the cancel rate limit is exceeded', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(req(validYollanma))
    expect(res.status).toBe(429)
  })

  it('400s an invalid identity', async () => {
    const res = await POST(req({ passportSeries: 'bad', jshshir: '1', email: 'nope' }))
    expect(res.status).toBe(400)
  })

  it('404s when no permit matches the identity', async () => {
    mocks.selectMaybeSingle.mockResolvedValue({ data: null, error: null })
    const res = await POST(req(validYollanma))
    expect(res.status).toBe(404)
  })

  it('409s a permit that is no longer pending', async () => {
    mocks.selectMaybeSingle.mockResolvedValue({ data: { id: 'perm1', status: 'approved', faculty: 'amit' }, error: null })
    const res = await POST(req(validYollanma))
    expect(res.status).toBe(409)
    expect(mocks.deleteSelect).not.toHaveBeenCalled()
  })

  it('409s a race where the dekan ruled on it between select and delete', async () => {
    mocks.selectMaybeSingle.mockResolvedValue({ data: { id: 'perm1', status: 'pending', faculty: 'amit' }, error: null })
    mocks.deleteSelect.mockResolvedValue({ data: [], error: null })
    const res = await POST(req(validYollanma))
    expect(res.status).toBe(409)
  })

  it('500s when the select query errors', async () => {
    mocks.selectMaybeSingle.mockResolvedValue({ data: null, error: new Error('db down') })
    const res = await POST(req(validYollanma))
    expect(res.status).toBe(500)
  })

  it('cancels a pending permit, removes its file, and audit-logs it', async () => {
    mocks.selectMaybeSingle.mockResolvedValue({
      data: { id: 'perm1', status: 'pending', faculty: 'amit', permit_url: 'perm1/file.pdf' },
      error: null,
    })
    mocks.deleteSelect.mockResolvedValue({ data: [{ id: 'perm1' }], error: null })
    const res = await POST(req(validYollanma))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mocks.storageRemove).toHaveBeenCalledWith(['perm1/file.pdf'])
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'permit_request.cancelled',
      status: 'success',
    }))
  })

  it('skips file removal when the permit has no stored file', async () => {
    mocks.selectMaybeSingle.mockResolvedValue({ data: { id: 'perm1', status: 'pending', faculty: 'amit', permit_url: null }, error: null })
    mocks.deleteSelect.mockResolvedValue({ data: [{ id: 'perm1' }], error: null })
    const res = await POST(req(validYollanma))
    expect(res.status).toBe(200)
    expect(mocks.storageRemove).not.toHaveBeenCalled()
  })
})

describe('email ownership proof', () => {
  it('401s without a valid proof for the email', async () => {
    emailProof.ok = false
    const res = await POST(req(validYollanma))
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('EMAIL_PROOF_REQUIRED')
  })
})
