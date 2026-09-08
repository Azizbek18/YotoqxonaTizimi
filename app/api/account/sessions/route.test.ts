import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), cookieGetClaims: vi.fn(), rpc: vi.fn(), from: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getClaims: mocks.getClaims } }) }))
vi.mock('@/lib/server-admin', () => ({
  createServerSupabaseClient: async () => ({ auth: { getClaims: mocks.cookieGetClaims } }),
}))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: () => ({ rpc: mocks.rpc, from: mocks.from }) }))
vi.mock('@/lib/security', () => ({ checkRateLimit: async () => ({ allowed: true }), getClientIp: () => '127.0.0.1' }))
vi.mock('@/lib/email', () => ({ sendSessionsRevokedEmail: vi.fn() }))
vi.mock('@/lib/student-telegram', () => ({ sendStudentTelegram: vi.fn().mockResolvedValue(undefined) }))

// Exercise the real route, auth helper, and session repository together.
import { GET, POST } from './route'
const currentId = '11111111-1111-4111-8111-111111111111'
const secondId = '22222222-2222-4222-8222-222222222222'
const foreignId = '33333333-3333-4333-8333-333333333333'
let sessions: Map<string, string>

beforeEach(() => {
  vi.clearAllMocks()
  sessions = new Map([[currentId, 'user-1'], [secondId, 'user-1'], [foreignId, 'user-2']])
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://project.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'anon'
  const verified = { data: { claims: { sub: 'user-1', session_id: currentId } }, error: null }
  mocks.getClaims.mockResolvedValue(verified)
  mocks.cookieGetClaims.mockResolvedValue(verified)
  const profile = { select: () => profile, eq: () => profile, maybeSingle: async () => ({ data: null, error: null }) }
  mocks.from.mockReturnValue(profile)
  mocks.rpc.mockImplementation((name: string, args: Record<string, string>) => {
    if (name === 'list_user_sessions') {
      const rows = [...sessions].filter(([, owner]) => owner === args.p_user_id).map(([id]) => ({
        id, created_at: '2026-09-01T00:00:00Z', refreshed_at: null, user_agent: null, ip: null, not_after: null,
      }))
      return {
        eq: (_column: string, id: string) => ({ maybeSingle: async () => ({ data: rows.find((row) => row.id === id) ?? null, error: null }) }),
        then: (resolve: (value: unknown) => unknown) => resolve({ data: rows, error: null }),
      }
    }
    let count = 0
    for (const [id, owner] of sessions) {
      if (owner === args.p_user_id && (name === 'revoke_user_session'
        ? id === args.p_session_id : id !== args.p_keep_session_id)) {
        sessions.delete(id)
        count++
      }
    }
    return Promise.resolve({ data: name === 'revoke_user_session' ? count > 0 : count, error: null })
  })
})

function request(body?: unknown, cookie = false) {
  return new NextRequest('https://app.test/api/account/sessions', {
    method: body === undefined ? 'GET' : 'POST',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    headers: cookie ? {} : { authorization: 'Bearer signed-token' },
  })
}

describe.each([false, true])('device management (cookie=%s)', (cookie) => {
  it('marks the current device and preserves it when revoking other devices', async () => {
    const list = await GET(request(undefined, cookie))
    expect(list.status).toBe(200)
    expect((await list.json()).sessions).toEqual([
      expect.objectContaining({ id: currentId, current: true }),
      expect.objectContaining({ id: secondId, current: false }),
    ])
    const result = await POST(request({ action: 'revoke-others' }, cookie))
    expect(await result.json()).toEqual({ ok: true, revoked: 1 })
    expect([...sessions.keys()]).toEqual([currentId, foreignId])
  })

  it('blocks a revoked token from listing or revoking the remaining devices', async () => {
    sessions.delete(currentId)
    expect((await GET(request(undefined, cookie))).status).toBe(401)
    expect((await POST(request({ action: 'revoke-others' }, cookie))).status).toBe(401)
    expect([...sessions.keys()]).toEqual([secondId, foreignId])
    expect(mocks.rpc.mock.calls.every(([name]) => name === 'list_user_sessions')).toBe(true)
  })

  it('prevents revoking the current device', async () => {
    expect((await POST(request({ action: 'revoke', sessionId: currentId }, cookie))).status).toBe(400)
    expect(sessions.has(currentId)).toBe(true)
  })

  it('revokes a selected device and rejects its next request with the same signed token', async () => {
    expect((await POST(request({ action: 'revoke', sessionId: secondId }, cookie))).status).toBe(200)
    const revokedClaims = { data: { claims: { sub: 'user-1', session_id: secondId } }, error: null }
    mocks.getClaims.mockResolvedValue(revokedClaims)
    mocks.cookieGetClaims.mockResolvedValue(revokedClaims)
    expect((await POST(request({ action: 'revoke-others' }, cookie))).status).toBe(401)
    expect(sessions.has(currentId)).toBe(true)
  })

  it('cannot revoke a device belonging to another user', async () => {
    const response = await POST(request({ action: 'revoke', sessionId: foreignId }, cookie))
    expect(await response.json()).toEqual({ ok: false, revoked: 0 })
    expect(sessions.has(foreignId)).toBe(true)
  })
})
