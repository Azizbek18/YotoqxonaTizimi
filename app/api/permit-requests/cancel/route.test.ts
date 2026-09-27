import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-secret-key-for-email-proof'

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(),
  writeAuditLog: vi.fn(),
  from: vi.fn(),
  storageRemove: vi.fn(),
  sendEmailVerificationCode: vi.fn(),
  domainAcceptsMail: vi.fn(),
}))

vi.mock('@/lib/security', () => ({ checkRateLimit: mocks.checkRateLimit, getClientIp: mocks.getClientIp }))
vi.mock('@/lib/audit-log', () => ({ writeAuditLog: mocks.writeAuditLog }))
vi.mock('@/lib/email', () => ({ sendEmailVerificationCode: mocks.sendEmailVerificationCode }))
vi.mock('@/lib/email-domain', () => ({ domainAcceptsMail: mocks.domainAcceptsMail }))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({
    from: mocks.from,
    storage: { from: () => ({ remove: mocks.storageRemove }) },
  }),
}))

const emailProof = vi.hoisted(() => ({ ok: true }))
vi.mock('@/lib/email-proof', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email-proof')>()),
  hasEmailProof: () => emailProof.ok,
}))

const { POST } = await import('./route')

type Result = { data?: unknown; error?: unknown }

const state = {
  select: { data: null, error: null } as Result,
  delete: { data: null, error: null } as Result,
}

function selectChain() {
  const b: Record<string, unknown> = {
    eq: () => b,
    is: () => b,
    maybeSingle: async () => state.select,
  }
  return b
}

function deleteChain() {
  const b: Record<string, unknown> = {
    eq: () => b,
    select: async () => state.delete,
  }
  return b
}

function req(body: unknown) {
  return new NextRequest('https://example.test/api/permit-requests/cancel', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const identityOnly = { passportSeries: 'AB1234567', jshshir: '12345678901234' }
const pendingPermit = { id: 'perm1', email: 'onfile@example.com', status: 'pending', faculty: 'amit', permit_url: 'perm1/file.pdf' }

beforeEach(() => {
  vi.resetAllMocks()
  emailProof.ok = true
  state.select = { data: null, error: null }
  state.delete = { data: null, error: null }
  mocks.getClientIp.mockReturnValue('127.0.0.1')
  mocks.checkRateLimit.mockResolvedValue({ allowed: true })
  mocks.writeAuditLog.mockResolvedValue(undefined)
  mocks.storageRemove.mockResolvedValue({ data: null, error: null })
  mocks.sendEmailVerificationCode.mockResolvedValue({ ok: true })
  mocks.domainAcceptsMail.mockResolvedValue(true)
  mocks.from.mockImplementation(() => ({
    select: () => selectChain(),
    delete: () => deleteChain(),
  }))
})

describe('POST /api/permit-requests/cancel — identity lookup', () => {
  it('429s when the cancel rate limit is exceeded, before any lookup', async () => {
    mocks.checkRateLimit.mockResolvedValue({ allowed: false })
    const res = await POST(req(identityOnly))
    expect(res.status).toBe(429)
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('400s an invalid identity', async () => {
    const res = await POST(req({ passportSeries: 'bad', jshshir: '1' }))
    expect(res.status).toBe(400)
  })

  it('404s when no permit matches the identity', async () => {
    state.select = { data: null, error: null }
    const res = await POST(req(identityOnly))
    expect(res.status).toBe(404)
  })

  it('409s a permit that is no longer pending — before ever touching email', async () => {
    state.select = { data: { ...pendingPermit, status: 'approved' }, error: null }
    const res = await POST(req(identityOnly))
    expect(res.status).toBe(409)
    expect(mocks.sendEmailVerificationCode).not.toHaveBeenCalled()
  })

  it('500s when the select query errors', async () => {
    state.select = { data: null, error: new Error('db down') }
    const res = await POST(req(identityOnly))
    expect(res.status).toBe(500)
  })
})

describe('POST /api/permit-requests/cancel — mail the code to the on-file email', () => {
  it('sends the code to the ON-FILE email and never echoes it back', async () => {
    state.select = { data: pendingPermit, error: null }
    const res = await POST(req(identityOnly))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.requiresEmailProof).toBe(true)
    expect(body.email).toBeUndefined()
    expect(mocks.sendEmailVerificationCode).toHaveBeenCalledWith('onfile@example.com', expect.any(String))
    const [payload] = String(body.challenge).split('.')
    expect(Buffer.from(payload, 'base64url').toString('utf8')).not.toContain('onfile@example.com')
  })

  it("429s once the record's own code budget is spent", async () => {
    state.select = { data: pendingPermit, error: null }
    mocks.checkRateLimit
      .mockResolvedValueOnce({ allowed: true }) // permit-cancel:{ip}
      .mockResolvedValueOnce({ allowed: false }) // permit-cancel-code:{id}
    const res = await POST(req(identityOnly))
    expect(res.status).toBe(429)
    expect(mocks.sendEmailVerificationCode).not.toHaveBeenCalled()
  })

  it("502s when the on-file email domain can't receive mail", async () => {
    state.select = { data: pendingPermit, error: null }
    mocks.domainAcceptsMail.mockResolvedValue(false)
    const res = await POST(req(identityOnly))
    expect(res.status).toBe(502)
    expect(mocks.sendEmailVerificationCode).not.toHaveBeenCalled()
  })

  it('502s in production when the mail cannot be sent (never leaks a dev code)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    state.select = { data: pendingPermit, error: null }
    mocks.sendEmailVerificationCode.mockResolvedValue({ ok: false })
    try {
      const res = await POST(req(identityOnly))
      expect(res.status).toBe(502)
      expect(await res.json()).not.toHaveProperty('devCode')
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('POST /api/permit-requests/cancel — email + proof supplied', () => {
  const withProof = { ...identityOnly, email: 'onfile@example.com', emailProof: 'proof-token' }

  it('401s a proof for an email that is not the one on file, even if hasEmailProof would accept it', async () => {
    state.select = { data: pendingPermit, error: null }
    const res = await POST(req({ ...identityOnly, email: 'someone-else@example.com', emailProof: 'proof-token' }))
    expect(res.status).toBe(401)
    expect((await res.json()).code).toBe('EMAIL_PROOF_REQUIRED')
  })

  it('401s without a valid proof for the on-file email', async () => {
    emailProof.ok = false
    state.select = { data: pendingPermit, error: null }
    const res = await POST(req(withProof))
    expect(res.status).toBe(401)
  })

  it('409s a race where the dekan ruled on it between select and delete', async () => {
    state.select = { data: pendingPermit, error: null }
    state.delete = { data: [], error: null }
    const res = await POST(req(withProof))
    expect(res.status).toBe(409)
  })

  it('cancels the pending permit, removes its file, and audit-logs it', async () => {
    state.select = { data: pendingPermit, error: null }
    state.delete = { data: [{ id: 'perm1' }], error: null }
    const res = await POST(req(withProof))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(mocks.storageRemove).toHaveBeenCalledWith(['perm1/file.pdf'])
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'permit_request.cancelled',
      status: 'success',
    }))
  })

  it('skips file removal when the permit has no stored file', async () => {
    state.select = { data: { ...pendingPermit, permit_url: null }, error: null }
    state.delete = { data: [{ id: 'perm1' }], error: null }
    const res = await POST(req(withProof))
    expect(res.status).toBe(200)
    expect(mocks.storageRemove).not.toHaveBeenCalled()
  })
})
