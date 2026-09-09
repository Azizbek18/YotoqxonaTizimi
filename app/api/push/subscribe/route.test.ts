import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getRequestUser: vi.fn(), from: vi.fn(), upsert: vi.fn(),
  permit: { id: 'permit-1', passport: 'AB1234567', email: 'student_test@example.com' },
}))
vi.mock('@/lib/server-auth', () => ({ getRequestUser: mocks.getRequestUser }))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: () => ({ from: mocks.from }) }))
vi.mock('@/lib/security', () => ({
  checkRateLimit: async () => ({ allowed: true }), getClientIp: () => '127.0.0.1',
}))
import { POST } from './route'

const subscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/token',
  keys: { p256dh: 'x'.repeat(87), auth: 'a'.repeat(22) },
  permitBinding: { id: 'permit-1', passport: 'AB1234567', email: 'student_test@example.com' },
}
const request = (body: unknown) => new Request('https://app.test/api/push/subscribe', {
  method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
})

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getRequestUser.mockResolvedValue(null)
  mocks.upsert.mockResolvedValue({ error: null })
  mocks.from.mockImplementation((table: string) => {
    if (table === 'push_subscriptions') return { upsert: mocks.upsert }
    const filters = new Map<string, unknown>()
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.set(key, value); return query },
      maybeSingle: async () => ({
        data: table === 'users' ? { id: 'student-1', role: 'talaba', status: 'active' }
          : filters.get('id') === mocks.permit.id
            && filters.get('passport_series') === mocks.permit.passport
            && filters.get('email') === mocks.permit.email ? { id: mocks.permit.id } : null,
        error: null,
      }),
    }
    return query
  })
})

describe('push subscription security', () => {
  it.each(['%', '_', '%@example.com', 'student%test@example.com', 'studentXtest@example.com'])
  ('cannot bind another email using a SQL pattern: %s', async (email) => {
    const response = await POST(request({ ...subscription, permitBinding: { ...subscription.permitBinding, email } }))
    expect([400, 403]).toContain(response.status)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('accepts the exact email after trimming and lowercasing', async () => {
    const response = await POST(request({
      ...subscription, permitBinding: { ...subscription.permitBinding, email: ' STUDENT_TEST@EXAMPLE.COM ' },
    }))
    expect(response.status).toBe(200)
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ permit_request_id: 'permit-1' }), expect.anything())
  })

  it('allows an active student to subscribe', async () => {
    mocks.getRequestUser.mockResolvedValue({ id: 'student-1' })
    expect((await POST(request(subscription))).status).toBe(200)
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'student-1' }), expect.anything())
  })

  it.each(['https://127.0.0.1/internal', 'https://evil.example/push', 'https://fcm.googleapis.com.evil.example/'])
  ('rejects a hostile endpoint before database access: %s', async (endpoint) => {
    expect((await POST(request({ ...subscription, endpoint }))).status).toBe(400)
    expect(mocks.from).not.toHaveBeenCalled()
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it.each([null, [], 'text'])('rejects malformed bodies: %s', async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })
})
