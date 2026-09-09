import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ sendNotification: vi.fn(), setVapidDetails: vi.fn(), from: vi.fn() }))
vi.mock('web-push', () => ({ default: {
  sendNotification: mocks.sendNotification, setVapidDetails: mocks.setVapidDetails,
} }))
vi.mock('@/lib/server-supabase', () => ({ getServiceSupabase: () => ({ from: mocks.from }) }))
import { sendPushForPermit, sendPushForUser } from './push-notifications'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('VAPID_PUBLIC_KEY', 'test-public-key')
  vi.stubEnv('VAPID_PRIVATE_KEY', 'test-private-key')
  mocks.sendNotification.mockResolvedValue({ statusCode: 201 })
})
afterEach(() => vi.unstubAllEnvs())

describe.each([sendPushForUser, sendPushForPermit])('push delivery', (send) => {
  it('never sends to unsafe legacy subscriptions and still delivers safe ones', async () => {
    const rows = [
      'https://127.0.0.1/private', 'https://attacker.example/push',
      'https://fcm.googleapis.com.evil.example/push', 'https://FCM.GOOGLEAPIS.COM:443/fcm/send/token',
    ].map((endpoint, id) => ({ id, endpoint, p256dh: 'key', auth: 'auth' }))
    const query = { select: () => query, eq: () => query, then: (resolve: (data: unknown) => unknown) => resolve({ data: rows, error: null }) }
    mocks.from.mockReturnValue(query)
    await send('owner-id', { title: 'Test', body: 'Test' })
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1)
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: 'https://fcm.googleapis.com/fcm/send/token' }),
      expect.any(String), expect.objectContaining({ timeout: 10_000 }),
    )
  })
})
