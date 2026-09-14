import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getRequestUser: vi.fn(),
  checkRateLimit: vi.fn(),
  state: {
    studentStatus: 'pending',
    isOffCampus: false,
  },
}))

function queryFor(table: string) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => table === 'staff'
      ? { data: null, error: null }
      : { data: { role: 'talaba', status: mocks.state.studentStatus, is_off_campus: mocks.state.isOffCampus }, error: null },
  }
  return builder
}

vi.mock('@/lib/server-auth', () => ({ getRequestUser: mocks.getRequestUser }))
vi.mock('@/lib/security', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIp: () => '127.0.0.1',
}))
vi.mock('@/lib/server-supabase', () => ({
  getServiceSupabase: () => ({ from: queryFor, rpc: mocks.rpc }),
}))

import { POST } from './route'

describe('resolve-role student activation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.state.studentStatus = 'pending'
    mocks.state.isOffCampus = false
    mocks.getRequestUser.mockResolvedValue({ id: 'student-id', email: 'Student@Example.com' })
    mocks.checkRateLimit.mockResolvedValue({ allowed: true })
    mocks.rpc.mockResolvedValue({ data: true, error: null })
  })

  it('activates a pending student through the service-only RPC', async () => {
    const response = await POST(new Request('https://example.test/api/auth/resolve-role', { method: 'POST' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, role: 'talaba' })
    expect(mocks.rpc).toHaveBeenCalledWith('activate_pending_student', {
      p_user_id: 'student-id',
      p_email: 'student@example.com',
    })
  })

  it('does not authorize a rejected student', async () => {
    mocks.state.studentStatus = 'rejected'
    const response = await POST(new Request('https://example.test/api/auth/resolve-role', { method: 'POST' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, role: null, reason: 'no_role' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })

  it('never calls activate_pending_student for a pending KV-talaba (no permit row to match)', async () => {
    mocks.state.isOffCampus = true
    const response = await POST(new Request('https://example.test/api/auth/resolve-role', { method: 'POST' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, role: null, reason: 'awaiting_dean_approval' })
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
